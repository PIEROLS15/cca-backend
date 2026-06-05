const BEARER_TOKEN = process.env.BEARER_TOKEN;
const API_URL = `${process.env.API_BASE_URL}/backend-certificado/request-meeting-minutes`;
const ADVANCED_URL = `${process.env.API_BASE_URL}/backend-certificado/certificate/advanced`;
const PAGE_LIMIT = 50;

const STATUS_MAP = {
  "por firmar": "PorFirmar",
  "por recoger": "PorRecoger",
  "entregado": "Entregado",
};

const SECTOR_ALIASES = {
  "9 de octubre - casuarinas": "nueve de octubre - las casuarinas",
  "9 de octubre miraflores": "nueve de octubre - miraflores",
  "9 de octubre - buena vista": "nueve de octubre - buena vista",
  "pacay": "el pacay",
  "porbenir - rosario de asia": "porvenir - rosario de asia",
};

const TERRAIN_ALIASES = {
  "institucional de uso com�n": "institucional de uso común",
};

async function fetchPage(page) {
  const url = `${API_URL}?limit=${PAGE_LIMIT}&page=${page}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 150) : ""}`);
  }
  const json = await res.json();
  return json?.data;
}

const ROLES_TO_TRY = ["presidente", "superadmin", "secretaria", "admin", "asistente"];

async function fetchAdvancedCert(certNumber) {
  for (const rol of ROLES_TO_TRY) {
    const url = `${ADVANCED_URL}?limit=1&page=1&rol=${rol}&countCertificate=${encodeURIComponent(certNumber)}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
    });
    if (!res.ok) continue;
    const json = await res.json();
    if (json?.data?.docs?.length) return json.data.docs[0];
  }
  return null;
}

function normalizeDni(raw) {
  let s = raw?.trim() || "";
  if (!s) return "";
  if (s[0] === "O") s = "0" + s.slice(1);
  if (s.length > 8) {
    const stripped = s.replace(/^0+/, "");
    if (stripped.length === 8) return stripped;
  }
  return s;
}

async function findOrCreateClient(prisma, dni, fullName, createdAt) {
  const normalized = normalizeDni(dni);
  if (!normalized) return null;
  let client = await prisma.client.findUnique({ where: { documentNumber: normalized } });
  if (!client) {
    client = await prisma.client.create({
      data: {
        documentNumber: normalized,
        fullName: fullName?.trim() || "-",
        createdAt: createdAt || new Date(),
        updatedAt: createdAt || new Date(),
      },
    });
  }
  return client;
}

async function seedAssemblyRecordRequests(prisma) {
  const existingCount = await prisma.assemblyRecordRequest.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} solicitudes de acta ya existen, saltando`);
    return;
  }

  console.log("  ℹ Cargando primera página...");

  let firstPage;
  try {
    firstPage = await fetchPage(1);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch assembly record requests: ${err.message}`);
    return;
  }

  if (!firstPage?.docs?.length) {
    console.log("  ℹ No assembly record requests to import");
    return;
  }

  const totalPages = firstPage.totalPages || 1;
  console.log(`  ℹ ${firstPage.totalDocs} solicitudes en ${totalPages} páginas`);

  const [sectorByName, terrainTypeByName, userByDni, allClients] = await Promise.all([
    prisma.sector.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((s) => [s.name.toLowerCase().trim(), s.id]))),
    prisma.terrainType.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((t) => [t.name.toLowerCase().trim(), t.id]))),
    prisma.user.findMany({ select: { id: true, dni: true } }).then((r) => new Map(r.filter((u) => u.dni).map((u) => [u.dni, u.id]))),
    prisma.client.findMany({ select: { id: true, documentNumber: true } }),
  ]);
  const clientByDoc = new Map(allClients.map((c) => [c.documentNumber, c.id]));

  let certByNumber = new Map(
    (await prisma.certificate.findMany({ select: { id: true, certificateNumber: true, clientId: true } }))
      .map((c) => [c.certificateNumber, { id: c.id, certificateNumber: c.certificateNumber, clientId: c.clientId }])
  );

  const allDocs = [...firstPage.docs];

  for (let page = 2; page <= totalPages; page++) {
    try {
      const data = await fetchPage(page);
      if (data?.docs) allDocs.push(...data.docs);
      process.stdout.write(`    Página ${page}/${totalPages}\r`);
    } catch (err) {
      console.warn(`\n  ⚠ Error en página ${page}: ${err.message}`);
    }
  }
  console.log(`\n  ℹ Total ${allDocs.length} solicitudes descargadas`);

  const existingCodes = new Set(
    (await prisma.assemblyRecordRequest.findMany({ select: { code: true } })).map((r) => r.code)
  );

  let imported = 0;
  let skipped = 0;
  let certsRecovered = 0;
  const seen = new Set();

  for (const doc of allDocs) {
    if (!doc._id) {
      skipped++;
      continue;
    }
    if (seen.has(doc._id)) {
      skipped++;
      continue;
    }
    if (existingCodes.has(doc._id)) {
      skipped++;
      continue;
    }
    seen.add(doc._id);

    const certId = doc.idCertificado?.trim();
    let cert = certId ? certByNumber.get(certId) : null;

    if (!cert && certId) {
      const rawDoc = await fetchAdvancedCert(certId);
      if (rawDoc) {
        const dniN = normalizeDni(rawDoc.dni);
        const client = dniN ? await findOrCreateClient(prisma, rawDoc.dni, rawDoc.nameLastSecondName, new Date(rawDoc.createdAt)) : null;
        if (!client) {
          skipped++;
          console.warn(`  ⚠ Cert ${certId}: sin cliente, acta omitida`);
          continue;
        }

        let sectorName = rawDoc.sectorLocation?.trim().toLowerCase() || "";
        if (sectorName && SECTOR_ALIASES[sectorName]) sectorName = SECTOR_ALIASES[sectorName];
        const sectorId = sectorName ? sectorByName.get(sectorName) : null;
        if (!sectorId) {
          skipped++;
          console.warn(`  ⚠ Cert ${certId}: sector "${rawDoc.sectorLocation}" no encontrado, acta omitida`);
          continue;
        }

        let terrainName = rawDoc.terrainType?.trim().toLowerCase() || "";
        if (terrainName && TERRAIN_ALIASES[terrainName]) terrainName = TERRAIN_ALIASES[terrainName];
        const terrainTypeId = terrainName ? terrainTypeByName.get(terrainName) : null;
        if (!terrainTypeId) {
          skipped++;
          console.warn(`  ⚠ Cert ${certId}: tipoTerreno "${rawDoc.terrainType}" no encontrado, acta omitida`);
          continue;
        }

        const userId = rawDoc.createdByDni ? userByDni.get(rawDoc.createdByDni) || null : null;
        const status = STATUS_MAP[rawDoc.status?.trim().toLowerCase()] || "PorFirmar";

        try {
          const newCert = await prisma.certificate.create({
            data: {
              certificateNumber: certId,
              requestNumber: rawDoc.nroSolicitud?.trim() || "",
              clientId: client.id,
              partnerId: null,
              sectorId,
              terrainTypeId,
              userId: userId || 1,
              width: rawDoc.anchoArea ? parseFloat(rawDoc.anchoArea) : null,
              length: rawDoc.largoArea ? parseFloat(rawDoc.largoArea) : null,
              totalArea: rawDoc.totalArea ? parseFloat(rawDoc.totalArea) : null,
              mz: rawDoc.mz?.trim() || null,
              lot: rawDoc.lote?.trim() || null,
              north: rawDoc.colindanciaNorte?.trim() || null,
              south: rawDoc.colindanciaSur?.trim() || null,
              east: rawDoc.colindanciaEste?.trim() || null,
              west: rawDoc.colindanciaOeste?.trim() || null,
              status,
              createdAt: new Date(rawDoc.createdAt),
              updatedAt: new Date(rawDoc.updatedAt),
            },
          });
          cert = { id: newCert.id, certificateNumber: certId, clientId: client.id };
          certByNumber.set(certId, cert);
          certsRecovered++;
          console.warn(`  ✓ Certificado recuperado: ${certId} (${rawDoc.nameLastSecondName})`);
        } catch (err) {
          skipped++;
          console.warn(`  ⚠ Error creando certificado ${certId}: ${err.message}`);
          continue;
        }
      } else {
        skipped++;
        console.warn(`  ⚠ Certificado no encontrado ni en advanced: "${certId}" | acta ${doc._id}`);
        continue;
      }
    }

    if (!cert) {
      skipped++;
      continue;
    }

    const description = [
      doc.description?.trim(),
      doc.typeUser === "comunero" ? null : `(${doc.typeUser})`,
      doc.buyerFullName?.trim() ? `Comprador: ${doc.buyerFullName.trim()}` : null,
      doc.sellerFullName?.trim() ? `Vendedor: ${doc.sellerFullName.trim()}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    try {
      await prisma.assemblyRecordRequest.create({
        data: {
          code: doc._id,
          clientId: cert.clientId,
          certificateId: cert.id,
          userId: null,
          description: description || null,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        },
      });
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing request "${doc._id}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} solicitudes de acta importadas, ${skipped} omitidas${certsRecovered > 0 ? `, ${certsRecovered} certificados recuperados` : ""}`);
}

module.exports = { seedAssemblyRecordRequests };

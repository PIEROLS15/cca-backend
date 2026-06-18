const BEARER_TOKEN = process.env.BEARER_TOKEN;
const API_URL = `${process.env.API_BASE_URL}/backend-certificado/certificate`;
const PAGE_LIMIT = 200;
const { mapRemoteCertificateMeasurements } = require("./certificate-measurements");
const { buildRequestLookup, resolveRequestNumberForCertificate } = require("./certificate-request-reconciliation");
const { collectLegacyOwnerCandidates, buildCertificateOwnerRecords } = require("./certificate-owners");
const { buildCertificateVerificationSnapshot } = require("../../src/api/certificates/utils/certificate-verification.utils");

const ROLES_TO_TRY = ["secretaria", "presidente", "superadmin"];

const SECTOR_ALIASES = {
  "9 de octubre - casuarinas": "nueve de octubre - las casuarinas",
  "9 de octubre miraflores": "nueve de octubre - miraflores",
  "9 de octubre - buena vista": "nueve de octubre - buena vista",
  "don jacinto - 9 de octubre": "don jacinto - nueve de octubre",
  "pacay": "el pacay",
  "porbenir - rosario de asia": "porvenir - rosario de asia",
};

const DNI_CORRECTIONS = {
  "154134089": "15413409",
  "422637825": "42263725",
  "2": "0.0",
};

const TERRAIN_ALIASES = {
  "institucional de uso com�n": "institucional de uso común",
};

const STATUS_MAP = {
  "por firmar": "PorFirmar",
  "por recoger": "PorRecoger",
  "entregado": "Entregado",
};

async function fetchAllPages(baseUrl) {
  const allDocs = [];
  const firstUrl = `${baseUrl}&page=1`;
  const res = await fetch(firstUrl, {
    headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ": " + body.slice(0, 150) : ""}`);
  }
  const json = await res.json();
  const data = json?.data;
  if (!data?.docs?.length) return allDocs;

  allDocs.push(...data.docs);
  const totalPages = data.totalPages || 1;

  for (let page = 2; page <= totalPages; page++) {
    try {
      const pageUrl = `${baseUrl}&page=${page}`;
      const r = await fetch(pageUrl, {
        headers: { Authorization: `Bearer ${BEARER_TOKEN}` },
      });
      if (r.ok) {
        const j = await r.json();
        if (j?.data?.docs) allDocs.push(...j.data.docs);
      }
      process.stdout.write(`    Página ${page}/${totalPages}\r`);
    } catch (err) {
      console.warn(`\n  ⚠ Error en página ${page}: ${err.message}`);
    }
  }
  return allDocs;
}

async function collectAllCertificates() {
  const seen = new Set();
  const all = [];

  async function addFromRol(rol) {
    const baseUrl = `${API_URL}?limit=${PAGE_LIMIT}&rol=${encodeURIComponent(rol)}`;
    let docs;
    try {
      docs = await fetchAllPages(baseUrl);
    } catch (err) {
      console.warn(`  ⚠ Error con rol=${rol || "ninguno"}: ${err.message}`);
      return;
    }
    let added = 0;
    for (const d of docs) {
      const key = d.countCertificate?.trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        all.push(d);
        added++;
      }
    }
    if (added > 0) {
      console.log(`  ✓ rol=${rol || "ninguno"} → ${added} nuevos certificados`);
    }
  }

  for (const rol of ROLES_TO_TRY) {
    await addFromRol(rol);
  }

  return all;
}

async function seedCertificates(prisma) {
  const existingCount = await prisma.certificate.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} certificados ya existen, saltando`);
    return;
  }

  console.log("  ℹ Colectando certificados desde todas las fuentes...");

  const allDocs = await collectAllCertificates();

  if (!allDocs.length) {
    console.log("  ℹ No certificates to import");
    return;
  }

  console.log(`  ℹ Total ${allDocs.length} certificados únicos descargados`);

  const [userByDni, clientByDoc, sectorByName, terrainTypeByName, requests] = await Promise.all([
    prisma.user.findMany({ select: { id: true, dni: true } }).then((r) => new Map(r.filter((u) => u.dni).map((u) => [u.dni, u.id]))),
    prisma.client.findMany({ select: { id: true, documentNumber: true } }).then((r) => new Map(r.map((c) => [c.documentNumber, c.id]))),
    prisma.sector.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((s) => [s.name.toLowerCase().trim(), s.id]))),
    prisma.terrainType.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((t) => [t.name.toLowerCase().trim(), t.id]))),
    prisma.certificateRequest.findMany({
      select: {
        id: true,
        requestNumber: true,
        createdAt: true,
        sectorLocation: true,
        client: { select: { documentNumber: true, fullName: true } },
        partner: { select: { documentNumber: true, fullName: true } },
      },
    }),
  ]);
  const requestLookup = buildRequestLookup(requests);

  function normalizeDni(raw) {
    let s = raw?.trim() || "";
    if (!s) return "";
    if (DNI_CORRECTIONS[s]) s = DNI_CORRECTIONS[s];
    if (s[0] === "O") s = "0" + s.slice(1);
    if (s.length > 8) {
      const stripped = s.replace(/^0+/, "");
      if (stripped.length === 8) return stripped;
    }
    return s;
  }

  function resolveDni(raw, clientByDoc) {
    const dni = normalizeDni(raw);
    if (!dni) return null;
    if (clientByDoc.get(dni)) return dni;
    return null;
  }

  const existingNumbers = new Set(
    (await prisma.certificate.findMany({ select: { certificateNumber: true } })).map((c) => c.certificateNumber)
  );

  const missingDocs = new Map();
  for (const doc of allDocs) {
    for (const candidate of collectLegacyOwnerCandidates(doc, null, normalizeDni)) {
      if (!candidate.documentNumber || candidate.documentNumber.length !== 8) continue;
      if (clientByDoc.get(candidate.documentNumber)) continue;
      if (!missingDocs.has(candidate.documentNumber)) {
        missingDocs.set(candidate.documentNumber, {
          fullName: candidate.fullName,
          createdAt: new Date(doc.createdAt),
        });
      }
    }
  }
  if (missingDocs.size > 0) {
    console.log(`  ℹ ${missingDocs.size} clientes faltantes, creando placeholders...`);
    for (const [dni, info] of missingDocs.entries()) {
      const placeholder = await prisma.client.create({
        data: {
          documentNumber: dni,
          fullName: info.fullName || "-",
          createdAt: info.createdAt,
          updatedAt: info.createdAt,
        },
      });
      clientByDoc.set(dni, placeholder.id);
      console.log(`    Placeholder: ${dni} (${info.fullName || "-"})`);
    }
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const seen = new Set();

  async function syncCertificateOwners(tx, certificateId, ownerRecords) {
    await tx.certificateOwner.deleteMany({ where: { certificateId } });
    if (ownerRecords.length === 0) return;

    await tx.certificateOwner.createMany({
      data: ownerRecords.map((owner) => ({
        certificateId,
        clientId: owner.clientId,
        order: owner.order,
        source: owner.source,
      })),
    });
  }

  for (const doc of allDocs) {
    const certificateNumber = doc.countCertificate?.trim();
    if (!certificateNumber) {
      skipped++;
      continue;
    }
    if (seen.has(certificateNumber)) {
      skipped++;
      continue;
    }
    seen.add(certificateNumber);

    const dni = resolveDni(doc.dni, clientByDoc);
    const clientId = dni ? clientByDoc.get(dni) : null;
    if (!clientId) {
      skipped++;
      console.warn(`  ⚠ Cliente no encontrado: DNI "${doc.dni}" | certificado ${certificateNumber}`);
      continue;
    }

    let sectorName = doc.sectorLocation?.trim().toLowerCase() || "";
    if (sectorName && SECTOR_ALIASES[sectorName]) {
      sectorName = SECTOR_ALIASES[sectorName];
    }
    const sectorId = sectorName ? sectorByName.get(sectorName) : null;
    if (!sectorId) {
      skipped++;
      console.warn(`  ⚠ Sector no encontrado: "${doc.sectorLocation}" | certificado ${certificateNumber}`);
      continue;
    }

    let terrainName = doc.terrainType?.trim().toLowerCase() || "";
    if (terrainName && TERRAIN_ALIASES[terrainName]) {
      terrainName = TERRAIN_ALIASES[terrainName];
    }
    const terrainTypeId = terrainName ? terrainTypeByName.get(terrainName) : null;
    if (!terrainTypeId) {
      skipped++;
      console.warn(`  ⚠ TipoTerreno no encontrado: "${doc.terrainType}" | certificado ${certificateNumber}`);
      continue;
    }

    const userId = doc.createdByDni ? userByDni.get(doc.createdByDni) || null : null;

    const status = STATUS_MAP[doc.status?.trim().toLowerCase()] || "PorFirmar";
    const measurements = mapRemoteCertificateMeasurements(doc);
    const { requestNumber, certificateRequestId } = resolveRequestNumberForCertificate({
      rawRequestNumber: doc.nroSolicitud,
      certificateNumber,
      clientDocumentNumber: dni,
      sectorName: doc.sectorLocation,
      mz: doc.mz,
      lot: doc.lote,
      createdAt: doc.createdAt,
    }, requestLookup);
    const linkedRequest = certificateRequestId ? requestLookup.requestById.get(certificateRequestId) || null : null;
    const ownerRecords = buildCertificateOwnerRecords(doc, linkedRequest, clientByDoc, normalizeDni);
    if (ownerRecords.length === 0) {
      skipped++;
      console.warn(`  ⚠ Sin dueños válidos: certificado ${certificateNumber}`);
      continue;
    }

    const primaryOwner = ownerRecords[0];
    const partnerOwner = ownerRecords[1] || null;
    const certificateData = {
      requestNumber,
      certificateRequestId,
      clientId: primaryOwner.clientId,
      partnerId: partnerOwner ? partnerOwner.clientId : null,
      sectorId,
      terrainTypeId,
      userId,
      width: measurements.width,
      length: measurements.length,
      totalArea: measurements.totalArea,
      area: measurements.area,
      perimeter: measurements.perimeter,
      additionalWidth: measurements.additionalWidth,
      additionalLength: measurements.additionalLength,
      measurementModeUsed: measurements.measurementModeUsed,
      mz: doc.mz?.trim() || null,
      lot: doc.lote?.trim() || null,
      north: doc.colindanciaNorte?.trim() || null,
      south: doc.colindanciaSur?.trim() || null,
      east: doc.colindanciaEste?.trim() || null,
      west: doc.colindanciaOeste?.trim() || null,
      legacyPayload: doc,
      issuedSnapshot: buildCertificateVerificationSnapshot({
        certificateNumber,
        owners: ownerRecords.map((owner) => ({
          fullName: owner.fullName,
          documentNumber: owner.documentNumber,
        })),
        terrain: {
          terrainType: { name: terrainName },
          width: measurements.width,
          length: measurements.length,
          totalArea: measurements.totalArea,
          area: measurements.area,
          perimeter: measurements.perimeter,
          additionalWidth: measurements.additionalWidth,
          additionalLength: measurements.additionalLength,
        },
        sector: sectorName,
        location: { mz: doc.mz?.trim() || null, lot: doc.lote?.trim() || null },
        borders: {
          north: doc.colindanciaNorte?.trim() || null,
          south: doc.colindanciaSur?.trim() || null,
          east: doc.colindanciaEste?.trim() || null,
          west: doc.colindanciaOeste?.trim() || null,
        },
        createdAt: new Date(doc.createdAt),
      }),
      status,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
    };

    if (existingNumbers.has(certificateNumber)) {
      await prisma.$transaction(async (tx) => {
        const certificate = await tx.certificate.update({
          where: { certificateNumber },
          data: certificateData,
          select: { id: true },
        });
        await syncCertificateOwners(tx, certificate.id, ownerRecords);
      });
      updated++;
      continue;
    }

    try {
      await prisma.$transaction(async (tx) => {
        const certificate = await tx.certificate.create({
          data: {
            certificateNumber,
            ...certificateData,
          },
          select: { id: true },
        });
        await syncCertificateOwners(tx, certificate.id, ownerRecords);
      });
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing certificate "${certificateNumber}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} certificados importados, ${updated} actualizados, ${skipped} omitidos`);
}

module.exports = { seedCertificates };

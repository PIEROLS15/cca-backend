const BEARER_TOKEN = process.env.BEARER_TOKEN;
const API_URL = `${process.env.API_BASE_URL}/backend-certificado/certificate`;
const PAGE_LIMIT = 200;

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

const STATUS_MAP = {
  "por firmar": "PorFirmar",
  "por recoger": "PorRecoger",
  "entregado": "Entregado",
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

async function seedCertificates(prisma) {
  const existingCount = await prisma.certificate.count();
  if (existingCount > 0 && !process.env.FORCE_SEEDS) {
    console.log(`  ℹ ${existingCount} certificados ya existen, saltando`);
    return;
  }

  console.log("  ℹ Cargando primera página...");

  let firstPage;
  try {
    firstPage = await fetchPage(1);
  } catch (err) {
    console.warn(`  ⚠ Could not fetch certificates: ${err.message}`);
    return;
  }

  if (!firstPage?.docs?.length) {
    console.log("  ℹ No certificates to import");
    return;
  }

  const totalPages = firstPage.totalPages || 1;
  console.log(`  ℹ ${firstPage.totalDocs} certificados en ${totalPages} páginas`);

  const [userByDni, clientByDoc, sectorByName, terrainTypeByName] = await Promise.all([
    prisma.user.findMany({ select: { id: true, dni: true } }).then((r) => new Map(r.filter((u) => u.dni).map((u) => [u.dni, u.id]))),
    prisma.client.findMany({ select: { id: true, documentNumber: true } }).then((r) => new Map(r.map((c) => [c.documentNumber, c.id]))),
    prisma.sector.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((s) => [s.name.toLowerCase().trim(), s.id]))),
    prisma.terrainType.findMany({ select: { id: true, name: true } }).then((r) => new Map(r.map((t) => [t.name.toLowerCase().trim(), t.id]))),
  ]);

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
  console.log(`\n  ℹ Total ${allDocs.length} certificados descargados`);

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

  function resolveDni(raw, clientByDoc) {
    const dni = normalizeDni(raw);
    if (!dni) return null;
    if (clientByDoc.get(dni)) return dni;
    return null;
  }

  const existingNumbers = new Set(
    (await prisma.certificate.findMany({ select: { certificateNumber: true } })).map((c) => c.certificateNumber)
  );

  // Crear placeholders para clientes faltantes
  const missingDocs = new Set();
  for (const doc of allDocs) {
    const dni = normalizeDni(doc.dni);
    if (dni && !clientByDoc.get(dni) && dni.length === 8) {
      missingDocs.add(dni);
    }
  }
  if (missingDocs.size > 0) {
    console.log(`  ℹ ${missingDocs.size} clientes faltantes, creando placeholders...`);
    for (const doc of allDocs) {
      const dni = normalizeDni(doc.dni);
      if (!dni || !missingDocs.has(dni) || dni.length !== 8) continue;
      missingDocs.delete(dni);
      const createdAt = new Date(doc.createdAt);
      const placeholder = await prisma.client.create({
        data: {
          documentNumber: dni,
          fullName: doc.nameLastSecondName?.trim() || "-",
          createdAt,
          updatedAt: createdAt,
        },
      });
      clientByDoc.set(dni, placeholder.id);
      console.log(`    Placeholder: ${dni} (${doc.nameLastSecondName || "-"})`);
    }
  }

  let imported = 0;
  let skipped = 0;
  const seen = new Set();

  for (const doc of allDocs) {
    const certificateNumber = doc.countCertificate?.trim();
    if (!certificateNumber) {
      skipped++;
      continue;
    }
    if (seen.has(certificateNumber)) {
      skipped++;
      console.warn(`  ⚠ Duplicado en API: ${certificateNumber}`);
      continue;
    }
    if (existingNumbers.has(certificateNumber)) {
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

    const partnerDni = doc.newThirDni?.trim() || null;
    const partnerId = partnerDni ? clientByDoc.get(partnerDni) || null : null;

    const status = STATUS_MAP[doc.status?.trim().toLowerCase()] || "PorFirmar";

    try {
      await prisma.certificate.create({
        data: {
          certificateNumber,
          requestNumber: doc.nroSolicitud?.trim() || "",
          clientId,
          partnerId,
          sectorId,
          terrainTypeId,
          userId,
          width: doc.anchoArea ? parseFloat(doc.anchoArea) : null,
          length: doc.largoArea ? parseFloat(doc.largoArea) : null,
          totalArea: doc.totalArea ? parseFloat(doc.totalArea) : null,
          mz: doc.mz?.trim() || null,
          lot: doc.lote?.trim() || null,
          north: doc.colindanciaNorte?.trim() || null,
          south: doc.colindanciaSur?.trim() || null,
          east: doc.colindanciaEste?.trim() || null,
          west: doc.colindanciaOeste?.trim() || null,
          status,
          createdAt: new Date(doc.createdAt),
          updatedAt: new Date(doc.updatedAt),
        },
      });
      imported++;
    } catch (err) {
      console.warn(`  ⚠ Error importing certificate "${certificateNumber}": ${err.message}`);
    }
  }

  console.log(`  ✓ ${imported} certificados importados, ${skipped} omitidos`);
}

module.exports = { seedCertificates };

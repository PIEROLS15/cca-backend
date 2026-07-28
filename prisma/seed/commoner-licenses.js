const fs = require("fs/promises");
const path = require("path");

const { resolveUploadDir } = require("../../src/utils/file-storage");

const REMOTE_BASE_URL = (process.env.COMMONER_LICENSE_SOURCE_BASE_URL || "https://api.comunidadcampesina-asia.com").replace(/\/+$/, "");
const PRESERVED_FILES = new Set([".gitignore", ".gitkeep"]);

const parseDate = (value) => {
  if (value instanceof Date) {
    return value;
  }

  const text = String(value || "").trim();
  if (!text) {
    return new Date();
  }

  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) {
    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  return new Date();
};

const normalizeText = (value) => String(value || "").trim();

const normalizePhotoPath = (photoPath) => {
  const value = normalizeText(photoPath);
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.pathname || null;
  } catch {
    return value.startsWith("/") ? value : `/${value}`;
  }
};

const buildRemotePhotoUrl = (photoPath) => {
  if (!photoPath) {
    return null;
  }

  try {
    return new URL(photoPath).toString();
  } catch {
    return new URL(photoPath, REMOTE_BASE_URL).toString();
  }
};

const downloadRemotePhoto = async (photoPath, uploadDir) => {
  const remoteUrl = buildRemotePhotoUrl(photoPath);
  if (!remoteUrl) {
    throw new Error("El carnet no tiene ruta de imagen");
  }

  const response = await fetch(remoteUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen (${response.status})`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const fileName = path.basename(new URL(remoteUrl).pathname);
  const filePath = path.join(uploadDir, fileName);

  await fs.writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    publicPath: normalizePhotoPath(photoPath),
  };
};

async function seedCommonerLicenses(prisma, api) {
  const uploadDir = resolveUploadDir();

  try {
    await fs.mkdir(uploadDir, { recursive: true });

    const existingFiles = await fs.readdir(uploadDir, { withFileTypes: true });
    await Promise.all(existingFiles.map(async (entry) => {
      if (PRESERVED_FILES.has(entry.name)) {
        return;
      }

      await fs.rm(path.join(uploadDir, entry.name), { recursive: true, force: true });
    }));

    const remoteLicenses = await api.listAll("/api/commoner-licenses", { limit: 100 });

    if (!Array.isArray(remoteLicenses) || remoteLicenses.length === 0) {
      await prisma.commonerLicense.deleteMany();
      console.log("  ℹ No hay carnets de comunero para importar");
      return;
    }

    const preparedLicenses = [];
    let downloaded = 0;
    let skipped = 0;

    for (const remoteLicense of remoteLicenses) {
      const id = Number(remoteLicense?.id);
      const dni = normalizeText(remoteLicense?.dni);
      const licenseNumber = normalizeText(remoteLicense?.licenseNumber);
      const photoPath = normalizePhotoPath(remoteLicense?.photoPath || remoteLicense?.photoUrl);

      if (!id || !dni || !licenseNumber || !photoPath) {
        skipped++;
        console.warn(`  ⚠ Carnet omitido por datos incompletos: ${id || "sin id"} / ${dni || "sin dni"} / ${licenseNumber || "sin carnet"}`);
        continue;
      }

      try {
        const savedPhoto = await downloadRemotePhoto(photoPath, uploadDir);

        preparedLicenses.push({
          id,
          dni,
          licenseNumber,
          fullName: normalizeText(remoteLicense?.fullName) || [remoteLicense?.firstNames, remoteLicense?.lastNames].filter(Boolean).map((part) => String(part).trim()).join(" "),
          firstNames: normalizeText(remoteLicense?.firstNames),
          lastNames: normalizeText(remoteLicense?.lastNames),
          gender: normalizeText(remoteLicense?.gender),
          birthDate: parseDate(remoteLicense?.birthDate),
          address: normalizeText(remoteLicense?.address),
          photoPath: savedPhoto.publicPath,
          createdAt: parseDate(remoteLicense?.createdAt),
          updatedAt: parseDate(remoteLicense?.updatedAt),
        });

        downloaded++;
      } catch (error) {
        skipped++;
        console.warn(`  ⚠ No se pudo descargar el carnet #${id} (${licenseNumber}): ${error.message}`);
      }
    }

    if (!preparedLicenses.length) {
      console.warn("  ⚠ No se importo ningun carnet porque todas las descargas fallaron");
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.commonerLicense.deleteMany();

      for (const license of preparedLicenses) {
        await tx.commonerLicense.create({
          data: license,
        });
      }
    });

    console.log(`  ✓ ${preparedLicenses.length} carnets importados, ${downloaded} imagenes descargadas, ${skipped} omitidos`);
  } catch (error) {
    console.warn(`  ⚠ No se pudieron importar los carnets de comunero: ${error.message}`);
  }
}

async function syncCommonerLicenseSequence(prisma) {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"CommonerLicense"', 'id'),
      COALESCE((SELECT MAX(id) FROM "CommonerLicense"), 1),
      (SELECT COUNT(*) > 0 FROM "CommonerLicense")
    )
  `);
}

module.exports = { seedCommonerLicenses, syncCommonerLicenseSequence };

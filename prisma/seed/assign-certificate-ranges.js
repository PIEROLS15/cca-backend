require("dotenv").config();

const { PrismaClient } = require("@prisma/client");
const { CERTIFICATE_RANGE_DEFAULT_LENGTH } = require("../../src/utils/certificate-range.utils");

const SEED_CERTIFICATE_RANGE_LENGTH = 1000;

function parseCertificateNumber(value) {
  const numeric = Number(String(value || "").trim());
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function overlaps(a, b) {
  return a.start <= b.end && a.end >= b.start;
}

function findConflict(range, occupied) {
  return occupied.find((item) => overlaps(range, item)) || null;
}

function allocateRange(currentLast, occupied, excludeId = null) {
  let start = Math.max(currentLast + 1, 1);
  let end = start + CERTIFICATE_RANGE_DEFAULT_LENGTH - 1;

  occupied.sort((a, b) => a.start - b.start);

  let conflict = findConflict({ start, end }, occupied.filter((item) => item.id !== excludeId));
  while (conflict) {
    start = conflict.end + 1;
    end = start + CERTIFICATE_RANGE_DEFAULT_LENGTH - 1;
    conflict = findConflict({ start, end }, occupied.filter((item) => item.id !== excludeId));
  }

  return { start, end };
}

async function assignCertificateRanges(prisma) {
  const seedUsername = process.env.SEED_LOGIN_USERNAME || process.env.E2E_USERNAME || "pierols";
  const certificates = await prisma.certificate.findMany({
    select: {
      userId: true,
      certificateNumber: true,
      createdAt: true,
    },
    orderBy: [
      { createdAt: "asc" },
      { id: "asc" },
    ],
  });

  const byUser = new Map();
  for (const certificate of certificates) {
    const lastCertificate = parseCertificateNumber(certificate.certificateNumber);
    if (!lastCertificate) continue;

    // Keep the latest issued certificate by createdAt, not the highest number.
    byUser.set(certificate.userId, {
      userId: certificate.userId,
      lastCertificate,
    });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { in: [...byUser.keys()] },
    },
    select: {
      id: true,
      username: true,
      fullName: true,
      certificateRangeStart: true,
      certificateRangeEnd: true,
      lastCertificate: true,
    },
  });

  const occupied = (await prisma.user.findMany({
    where: {
      certificateRangeStart: { not: null },
      certificateRangeEnd: { not: null },
    },
    select: {
      id: true,
      certificateRangeStart: true,
      certificateRangeEnd: true,
    },
  }))
    .map((user) => ({
      id: user.id,
      start: user.certificateRangeStart,
      end: user.certificateRangeEnd,
    }))
    .filter((item) => item.start != null && item.end != null);

  const sortedUsers = users
    .map((user) => ({
      ...user,
      lastCertificate: byUser.get(user.id)?.lastCertificate || null,
    }))
    .sort((a, b) => (a.lastCertificate || 0) - (b.lastCertificate || 0));

  let updated = 0;

  for (const user of sortedUsers) {
    const currentLast = user.lastCertificate || 0;
    const { start, end } = allocateRange(currentLast, occupied, user.id);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        certificateRangeStart: start,
        certificateRangeEnd: end,
        lastCertificate: currentLast,
      },
    });

    const existingIndex = occupied.findIndex((item) => item.id === user.id);
    if (existingIndex >= 0) {
      occupied[existingIndex] = { id: user.id, start, end };
    } else {
      occupied.push({ id: user.id, start, end });
    }

    updated++;
    console.log(`  ✓ ${user.username} -> ${String(start).padStart(6, "0")} - ${String(end).padStart(6, "0")} (ultimo ${String(currentLast).padStart(6, "0")})`);
  }

  const seedUser = await prisma.user.findUnique({
    where: { username: seedUsername },
    select: {
      id: true,
      username: true,
      certificateRangeStart: true,
      certificateRangeEnd: true,
      lastCertificate: true,
    },
  });

  if (seedUser) {
    const highestOccupiedEnd = occupied
      .filter((item) => item.id !== seedUser.id)
      .reduce((max, item) => Math.max(max, item.end), 0);
    const start = highestOccupiedEnd + 1;
    const end = start + SEED_CERTIFICATE_RANGE_LENGTH - 1;

    await prisma.user.update({
      where: { id: seedUser.id },
      data: {
        certificateRangeStart: start,
        certificateRangeEnd: end,
        lastCertificate: start - 1,
      },
    });

    const existingIndex = occupied.findIndex((item) => item.id === seedUser.id);
    if (existingIndex >= 0) {
      occupied[existingIndex] = { id: seedUser.id, start, end };
    } else {
      occupied.push({ id: seedUser.id, start, end });
    }

    updated++;
    console.log(`  ✓ ${seedUser.username} -> ${String(start).padStart(6, "0")} - ${String(end).padStart(6, "0")} (usuario de seed)`);
  }

  console.log(`  ✓ ${updated} usuarios actualizados con rangos de certificados`);
}

if (require.main === module) {
  const prisma = new PrismaClient();

  assignCertificateRanges(prisma)
    .catch((error) => {
      console.error("Error asignando rangos:", error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

module.exports = { assignCertificateRanges };

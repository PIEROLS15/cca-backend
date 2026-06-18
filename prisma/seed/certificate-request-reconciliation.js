const GENERIC_LOCATION_TOKENS = new Set([
  "ANEXO",
  "CENTRO",
  "POBLADO",
  "DE",
  "DEL",
  "EL",
  "LA",
  "LAS",
  "LOS",
]);

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompact(value) {
  return normalizeText(value).replace(/[^A-Z0-9]/g, "");
}

function normalizeRequestNumber(value) {
  return normalizeText(value).replace(/^S/, "").trim();
}

function tokenizeSector(value) {
  return [...new Set(
    normalizeText(value)
      .split(/[^A-Z0-9]+/)
      .filter((token) => token && !GENERIC_LOCATION_TOKENS.has(token))
  )];
}

function extractRequestLocation(location) {
  const raw = normalizeText(location);
  if (!raw) {
    return { sector: "", mz: "", lot: "" };
  }

  const sector = raw.split(/\bMZ\b|\bLT\b|\bLOTE\b/)[0]?.trim() || raw;
  const mzMatch = raw.match(/\bMZ\b\s*:?\s*([A-Z0-9./-]+)/);
  const lotMatch = raw.match(/\b(?:LT|LOTE)\b\s*:?\s*([A-Z0-9./-]+)/);

  return {
    sector,
    mz: normalizeCompact(mzMatch?.[1] || ""),
    lot: normalizeCompact(lotMatch?.[1] || ""),
  };
}

function buildRequestLookup(requests) {
  const requestByNumber = new Map();
  const requestById = new Map();
  const requestsByClientDoc = new Map();

  for (const request of requests) {
    requestByNumber.set(request.requestNumber, request);
    requestById.set(request.id, request);

    const clientDoc = request.client?.documentNumber;
    if (!clientDoc) continue;

    const bucket = requestsByClientDoc.get(clientDoc) || [];
    bucket.push({
      ...request,
      parsedLocation: extractRequestLocation(request.sectorLocation),
      normalizedRequestNumber: normalizeRequestNumber(request.requestNumber),
    });
    requestsByClientDoc.set(clientDoc, bucket);
  }

  return {
    requestByNumber,
    requestById,
    requestsByClientDoc,
  };
}

function scoreSectorMatch(certificateSectorName, requestSectorName) {
  const certTokens = tokenizeSector(certificateSectorName);
  const reqTokens = new Set(tokenizeSector(requestSectorName));

  if (certTokens.length === 0) return 0;

  const overlap = certTokens.filter((token) => reqTokens.has(token)).length;
  if (overlap === certTokens.length) return 50;
  if (overlap >= Math.max(1, certTokens.length - 1)) return 30;
  if (overlap > 0) return 10;
  return -40;
}

function scoreExactField(certificateValue, requestValue, points) {
  const cert = normalizeCompact(certificateValue);
  const req = normalizeCompact(requestValue);

  if (!cert || !req) return 0;
  return cert === req ? points : -10;
}

function scoreDateDistance(certificateDate, requestDate) {
  const certTime = new Date(certificateDate).getTime();
  const reqTime = new Date(requestDate).getTime();
  if (Number.isNaN(certTime) || Number.isNaN(reqTime)) return 0;

  const diffDays = Math.abs(certTime - reqTime) / (1000 * 60 * 60 * 24);
  if (diffDays <= 7) return 20;
  if (diffDays <= 30) return 10;
  if (diffDays <= 90) return 5;
  return 0;
}

function getDateDistanceDays(certificateDate, requestDate) {
  const certTime = new Date(certificateDate).getTime();
  const reqTime = new Date(requestDate).getTime();
  if (Number.isNaN(certTime) || Number.isNaN(reqTime)) return Number.POSITIVE_INFINITY;
  return Math.abs(certTime - reqTime) / (1000 * 60 * 60 * 24);
}

function resolveCertificateRequestId(input, lookup) {
  const candidate = lookup.requestsByClientDoc.get(input.clientDocumentNumber) || [];
  if (!candidate.length) return null;

  const ranked = candidate
    .map((c) => ({
      candidate: c,
      dateDistanceDays: getDateDistanceDays(input.createdAt, c.createdAt),
      score:
        scoreSectorMatch(input.sectorName, c.parsedLocation.sector)
        + scoreExactField(input.mz, c.parsedLocation.mz, 25)
        + scoreExactField(input.lot, c.parsedLocation.lot, 25)
        + scoreDateDistance(input.createdAt, c.createdAt),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.dateDistanceDays - b.dateDistanceDays;
    });

  const best = ranked[0];
  const second = ranked[1];

  if (best && best.score >= 70) return best.candidate.id;

  if (
    best
    && best.score >= 50
    && (
      !second
      || best.score - second.score >= 10
      || best.dateDistanceDays + 7 < second.dateDistanceDays
    )
  ) {
    return best.candidate.id;
  }

  if (best && best.score >= 40 && ranked.filter((item) => item.score > 0).length === 1) {
    return best.candidate.id;
  }

  return null;
}

function resolveRequestNumberForCertificate(input, lookup) {
  const requestNumberRaw = input.rawRequestNumber?.trim() || "";
  const normalizedRequestNumber = normalizeRequestNumber(requestNumberRaw);

  const clientDoc = input.clientDocumentNumber;

  if (!requestNumberRaw) {
    return { requestNumber: "", certificateRequestId: null };
  }

  if (requestNumberRaw && lookup.requestByNumber.has(requestNumberRaw)) {
    const match = lookup.requestByNumber.get(requestNumberRaw);
    const matchClientDoc = match.client?.documentNumber;
    if (matchClientDoc === clientDoc) {
      return { requestNumber: match.requestNumber, certificateRequestId: match.id };
    }
  }

  if (normalizedRequestNumber) {
    const normalizedMatch = [...lookup.requestByNumber.values()].find(
      (request) => normalizeRequestNumber(request.requestNumber) === normalizedRequestNumber
    );
    if (normalizedMatch) {
      const matchClientDoc = normalizedMatch.client?.documentNumber;
      if (matchClientDoc === clientDoc) {
        return { requestNumber: normalizedMatch.requestNumber, certificateRequestId: normalizedMatch.id };
      }
      return { requestNumber: normalizedRequestNumber || "", certificateRequestId: null };
    }
  }

  return { requestNumber: normalizedRequestNumber || "", certificateRequestId: null };
}

module.exports = {
  buildRequestLookup,
  normalizeRequestNumber,
  resolveRequestNumberForCertificate,
};

function normalizeDni(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (s[0] === "O") s = "0" + s.slice(1);
  if (s.length > 8) {
    const stripped = s.replace(/^0+/, "");
    if (stripped.length === 8) return stripped;
  }
  return s;
}

function addCandidate(candidates, seen, candidate, normalize = normalizeDni) {
  const dni = normalize(candidate.documentNumber);
  if (!dni || seen.has(dni)) return;
  seen.add(dni);
  candidates.push({
    documentNumber: dni,
    fullName: String(candidate.fullName || "").trim() || "-",
    source: candidate.source || null,
  });
}

function collectLegacyOwnerCandidates(doc, request, normalize = normalizeDni) {
  const candidates = [];
  const seen = new Set();

  addCandidate(candidates, seen, {
    documentNumber: doc.dni,
    fullName: doc.nameLastSecondName,
    source: "certificate.primary",
  }, normalize);

  addCandidate(candidates, seen, {
    documentNumber: doc.newThirDni,
    fullName: doc.newNameThirdSecondName,
    source: "certificate.newThirDni",
  }, normalize);

  addCandidate(candidates, seen, {
    documentNumber: doc.newFortyDni,
    fullName: doc.newNameFortySecondName,
    source: "certificate.newFortyDni",
  }, normalize);

  if (Array.isArray(doc.forFiveDuenio)) {
    for (const item of doc.forFiveDuenio) {
      addCandidate(candidates, seen, {
        documentNumber: item?.fullDni,
        fullName: item?.fullName,
        source: "certificate.forFiveDuenio",
      }, normalize);
    }
  }

  if (request?.partner?.documentNumber) {
    addCandidate(candidates, seen, {
      documentNumber: request.partner.documentNumber,
      fullName: request.partner.fullName,
      source: "request.partner",
    }, normalize);
  }

  return candidates;
}

function collectLegacyOwnerDocuments(doc, request, normalize = normalizeDni) {
  return collectLegacyOwnerCandidates(doc, request, normalize).map((candidate) => candidate.documentNumber);
}

function buildCertificateOwnerRecords(doc, request, clientByDoc, normalize = normalizeDni) {
  return collectLegacyOwnerCandidates(doc, request, normalize)
    .map((candidate, index) => ({
      clientId: clientByDoc.get(candidate.documentNumber) || null,
      order: index + 1,
      source: candidate.source,
      documentNumber: candidate.documentNumber,
      fullName: candidate.fullName,
    }))
    .filter((candidate) => candidate.clientId != null);
}

module.exports = {
  normalizeDni,
  collectLegacyOwnerCandidates,
  collectLegacyOwnerDocuments,
  buildCertificateOwnerRecords,
};

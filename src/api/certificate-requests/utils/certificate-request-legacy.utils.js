const normalizeComparableText = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

const normalizeRequestDestination = (value, fallback) => {
  const candidates = [value, fallback].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeComparableText(candidate);

    if (normalized.includes("secretaria")) {
      return "Secretaria";
    }

    if (normalized.includes("ingeniero")) {
      return "Ingeniero";
    }
  }

  return String(value || fallback || "").trim();
};

const normalizeCertificateTypeLabel = (value, otherType) => {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("certificado") && normalized.includes("posesion")) {
    return { type: "CertificadoPosesion" };
  }

  if (normalized.includes("plano") && normalized.includes("memoria")) {
    return { type: "PlanoMemoria" };
  }

  if (normalized === "otros") {
    return {
      type: "Otros",
      otherType: String(otherType || "").trim() || undefined,
    };
  }

  return { type: String(value || "").trim() };
};

const normalizeCertificateTypes = (items = [], legacyPayload = null) => {
  const sourceItems = [
    ...((Array.isArray(items) ? items : []) || []),
    ...((Array.isArray(legacyPayload?.type) ? legacyPayload.type : []) || []).map((type) => ({ type })),
  ];
  const fallbackOtherType = String(legacyPayload?.otherType || "").trim() || undefined;
  const normalizedItems = [];
  const seen = new Set();

  for (const item of sourceItems) {
    const rawType = typeof item === "string" ? item : item?.type;
    const otherType = typeof item === "object" && item ? item.otherType : undefined;
    const normalizedItem = normalizeCertificateTypeLabel(rawType, otherType || fallbackOtherType);

    if (!normalizedItem) {
      continue;
    }

    const signature = `${normalizeComparableText(normalizedItem.type)}:${normalizeComparableText(normalizedItem.otherType || "")}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    normalizedItems.push(normalizedItem);
  }

  return normalizedItems;
};

const extractPhoneNumber = (value) => {
  const match = String(value || "").match(/(\d{6,})/);
  return match ? match[1] : undefined;
};

const normalizeAttachmentLabel = (value) => {
  const normalized = normalizeComparableText(value);

  if (!normalized) {
    return null;
  }

  if (normalized.includes("cert") && normalized.includes("anterior")) {
    return "CertAnterior";
  }

  if (normalized.includes("dni")) {
    return "CopiaDni";
  }

  if (normalized.includes("compraventa")) {
    return "CompraVenta";
  }

  if (normalized.includes("plano") && normalized.includes("memoria")) {
    return "CopiaPlanoMemoria";
  }

  if (normalized.includes("celular")) {
    return "Celular";
  }

  return String(value || "").trim();
};

const normalizeAttachments = (items = [], legacyPayload = null) => {
  const sourceItems = [
    ...((Array.isArray(items) ? items : []) || []),
    ...((Array.isArray(legacyPayload?.attachment) ? legacyPayload.attachment : []) || []).map((type) => ({ type })),
  ];
  const fallbackPhoneNumber = String(legacyPayload?.phoneNumber || "").trim() || undefined;
  const normalizedItems = [];
  const seen = new Set();

  for (const item of sourceItems) {
    const rawType = typeof item === "string" ? item : item?.type;
    const rawPhoneNumber = typeof item === "object" && item ? item.phoneNumber : undefined;
    const normalizedType = normalizeAttachmentLabel(rawType);

    if (!normalizedType) {
      continue;
    }

    const phoneNumber = String(rawPhoneNumber || extractPhoneNumber(rawType) || fallbackPhoneNumber || "").trim() || undefined;
    const signature = `${normalizeComparableText(normalizedType)}:${phoneNumber || ""}`;
    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    normalizedItems.push(
      normalizedType === "Celular"
        ? { type: normalizedType, ...(phoneNumber ? { phoneNumber } : {}) }
        : { type: normalizedType },
    );
  }

  return normalizedItems;
};

module.exports = {
  extractPhoneNumber,
  normalizeAttachmentLabel,
  normalizeAttachments,
  normalizeCertificateTypeLabel,
  normalizeCertificateTypes,
  normalizeComparableText,
  normalizeRequestDestination,
};

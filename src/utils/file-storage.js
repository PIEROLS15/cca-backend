const fs = require("fs/promises");
const path = require("path");
const HttpError = require("./http-error");

const DEFAULT_UPLOAD_DIR = "uploads/commoners";
const DEFAULT_PUBLIC_PREFIX = "/uploads/commoners";

const resolveUploadDir = () => path.resolve(process.cwd(), process.env.COMMONER_LICENSE_UPLOAD_DIR || DEFAULT_UPLOAD_DIR);

const resolvePublicPrefix = () => {
  const value = String(process.env.COMMONER_LICENSE_PUBLIC_PREFIX || DEFAULT_PUBLIC_PREFIX).trim();
  const normalized = value.endsWith("/") ? value.slice(0, -1) : value;
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
};

const sanitizeFileStem = (value) => String(value || "file")
  .trim()
  .replace(/[^a-z0-9_-]+/gi, "_")
  .replace(/^_+|_+$/g, "") || "file";

const mimeToExtension = (mime) => {
  switch (String(mime || "").toLowerCase()) {
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return null;
  }
};

const parseDataUri = (dataUri) => {
  const value = String(dataUri || "").trim();
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);

  if (!match) {
    throw new HttpError(400, "La imagen no tiene un data_uri valido");
  }

  const mime = match[1].toLowerCase();
  const extension = mimeToExtension(mime);

  if (!extension) {
    throw new HttpError(400, `Formato de imagen no soportado: ${mime}`);
  }

  return {
    mime,
    extension,
    buffer: Buffer.from(match[2], "base64"),
  };
};

const saveDataUriFile = async (dataUri, { fileStem, uploadDir, publicPrefix } = {}) => {
  const resolvedUploadDir = uploadDir || resolveUploadDir();
  const resolvedPrefix = publicPrefix || resolvePublicPrefix();
  const { extension, buffer } = parseDataUri(dataUri);
  const safeStem = sanitizeFileStem(fileStem);
  const fileName = `${safeStem}-${Date.now()}.${extension}`;
  const filePath = path.join(resolvedUploadDir, fileName);

  await fs.mkdir(resolvedUploadDir, { recursive: true });
  await fs.writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    publicPath: `${resolvedPrefix}/${fileName}`,
  };
};

const removeFileIfExists = async (filePath) => {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }
};

module.exports = {
  resolveUploadDir,
  resolvePublicPrefix,
  saveDataUriFile,
  removeFileIfExists,
  parseDataUri,
};

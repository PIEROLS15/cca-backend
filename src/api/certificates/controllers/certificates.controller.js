const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const certificatesService = require("../services/certificates.service");
const { buildCertificatePdf } = require("../utils/certificates-pdf.utils");

const listCertificates = asyncHandler(async (req, res) => {
  const data = await certificatesService.listCertificates(req.query);
  return sendSuccess(res, {
    message: "Certificados encontrados correctamente",
    data,
  });
});

const getCertificateById = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateById(Number(req.params.id));
  res.json(certificate);
});

const createCertificate = asyncHandler(async (req, res) => {
  if (!req.body.clientId) {
    throw new HttpError(400, "clientId es obligatorio");
  }

  const certificate = await certificatesService.createCertificate({
    ...req.body,
    clientId: Number(req.body.clientId),
    requestId: req.body.requestId ? Number(req.body.requestId) : undefined,
    sectorId: req.body.sectorId ? Number(req.body.sectorId) : undefined,
    terrainTypeId: req.body.terrainTypeId ? Number(req.body.terrainTypeId) : undefined,
  });

  res.status(201).json(certificate);
});

const updateCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.updateCertificate(Number(req.params.id), {
    ...req.body,
    sectorId: req.body.sectorId ? Number(req.body.sectorId) : null,
    terrainTypeId: req.body.terrainTypeId ? Number(req.body.terrainTypeId) : null,
  });
  res.json(certificate);
});

const deleteCertificate = asyncHandler(async (req, res) => {
  await certificatesService.deleteCertificate(Number(req.params.id));
  res.status(204).send();
});

const previewCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateById(Number(req.params.id));
  res.json({
    code: certificate.code,
    correlative: certificate.correlative,
    status: certificate.status,
    client: certificate.client.fullName,
    documentNumber: certificate.client.documentNumber,
    location: certificate.location,
    mz: certificate.mz,
    lot: certificate.lot,
    barcodeValue: certificate.code,
  });
});

const downloadCertificatePdf = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateById(Number(req.params.id));
  const pdfBuffer = await buildCertificatePdf(certificate);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="certificado-${certificate.code}.pdf"`);
  res.send(pdfBuffer);
});

module.exports = {
  listCertificates,
  getCertificateById,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  previewCertificate,
  downloadCertificatePdf,
};

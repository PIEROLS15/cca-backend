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
  if (!req.body.owners || !Array.isArray(req.body.owners) || req.body.owners.length === 0) {
    throw new HttpError(400, "owners es obligatorio y debe contener al menos un propietario");
  }

  const certificate = await certificatesService.createCertificate(req.body, req.user?.sub);
  res.status(201).json(certificate);
});

const updateCertificate = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.updateCertificate(Number(req.params.id), req.body);
  res.json(certificate);
});

const deleteCertificate = asyncHandler(async (req, res) => {
  await certificatesService.deleteCertificate(Number(req.params.id));
  res.status(204).send();
});

const previewDeleteCertificate = asyncHandler(async (req, res) => {
  const preview = await certificatesService.getCertificateDeletePreview(Number(req.params.id));
  res.json(preview);
});

const downloadCertificatePdf = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateById(Number(req.params.id));
  const pdfBuffer = await buildCertificatePdf(certificate);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="certificado-${certificate.certificateNumber}.pdf"`);
  res.send(pdfBuffer);
});

const downloadCertificatePdfByFilename = asyncHandler(async (req, res) => {
  const filename = req.params.filename || "";
  const certificateNumber = filename.replace(/^certificado-/, "").replace(/\.pdf$/, "");
  const certificate = await certificatesService.getCertificateByNumber(certificateNumber);
  const pdfBuffer = await buildCertificatePdf(certificate);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(pdfBuffer);
});

const lookupCertificateByNumber = asyncHandler(async (req, res) => {
  const certificate = await certificatesService.getCertificateByNumber(req.params.number);
  res.json(certificate);
});

module.exports = {
  listCertificates,
  getCertificateById,
  createCertificate,
  updateCertificate,
  deleteCertificate,
  previewDeleteCertificate,
  downloadCertificatePdf,
  downloadCertificatePdfByFilename,
  lookupCertificateByNumber,
};

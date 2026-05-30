const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const certificateRequestsService = require("../services/certificate-requests.service");
const { buildCertificateRequestPdf } = require("../utils/certificate-requests-pdf.utils");

const listCertificateRequests = asyncHandler(async (req, res) => {
  const data = await certificateRequestsService.listCertificateRequests({
    page: req.query.page,
    limit: req.query.limit,
  });
  return sendSuccess(res, {
    message: "Solicitudes de certificado encontradas correctamente",
    data,
  });
});

const getCertificateRequestById = asyncHandler(async (req, res) => {
  const request = await certificateRequestsService.getCertificateRequestById(req.params.id);
  res.json(request);
});

const createCertificateRequest = asyncHandler(async (req, res) => {
  if (!req.body.client?.documentNumber || !req.body.client?.fullName) {
    throw new HttpError(400, "client.fullName y client.documentNumber son obligatorios");
  }

  const request = await certificateRequestsService.createCertificateRequest(
    {
      ...req.body,
    },
    req.user?.sub
  );

  res.status(201).json(request);
});

const updateCertificateRequest = asyncHandler(async (req, res) => {
  const request = await certificateRequestsService.updateCertificateRequest(Number(req.params.id), req.body);
  res.json(request);
});

const deleteCertificateRequest = asyncHandler(async (req, res) => {
  await certificateRequestsService.deleteCertificateRequest(Number(req.params.id));
  res.status(204).send();
});

const downloadCertificateRequestPdf = asyncHandler(async (req, res) => {
  const filename = req.params.filename || "";
  const requestNumber = filename.replace(/^solicitud-certificado-/, "").replace(/\.pdf$/, "");
  const request = await certificateRequestsService.getCertificateRequestById(requestNumber);
  const pdfBuffer = await buildCertificateRequestPdf(request);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `inline; filename="${filename}"`
  );
  res.send(pdfBuffer);
});

module.exports = {
  listCertificateRequests,
  getCertificateRequestById,
  createCertificateRequest,
  updateCertificateRequest,
  deleteCertificateRequest,
  downloadCertificateRequestPdf,
};

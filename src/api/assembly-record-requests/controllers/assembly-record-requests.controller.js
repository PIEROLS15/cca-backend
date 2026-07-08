const asyncHandler = require("../../../utils/async-handler");
const HttpError = require("../../../utils/http-error");
const { sendSuccess } = require("../../../utils/api-response");
const assemblyRecordRequestsService = require("../services/assembly-record-requests.service");
const { buildAssemblyRecordRequestPdf } = require("../utils/assembly-record-requests-pdf.utils");

const listAssemblyRecordRequests = asyncHandler(async (req, res) => {
  const data = await assemblyRecordRequestsService.listAssemblyRecordRequests({
    page: req.query.page,
    limit: req.query.limit,
    search: req.query.search,
  });
  return sendSuccess(res, {
    message: "Solicitudes de acta encontradas correctamente",
    data,
  });
});

const getAssemblyRecordRequestById = asyncHandler(async (req, res) => {
  const request = await assemblyRecordRequestsService.getAssemblyRecordRequestById(Number(req.params.id));
  res.json(request);
});

const createAssemblyRecordRequest = asyncHandler(async (req, res) => {
  const { clientId, certificateId } = req.body;
  if (!clientId || !certificateId) {
    throw new HttpError(400, "clientId y certificateId son obligatorios");
  }

  const request = await assemblyRecordRequestsService.createAssemblyRecordRequest(
    {
      ...req.body,
      clientId: Number(clientId),
      certificateId: Number(certificateId),
    },
    req.user?.sub
  );

  res.status(201).json(request);
});

const updateAssemblyRecordRequest = asyncHandler(async (req, res) => {
  const request = await assemblyRecordRequestsService.updateAssemblyRecordRequest(Number(req.params.id), req.body, req.user?.sub);
  res.json(request);
});

const deleteAssemblyRecordRequest = asyncHandler(async (req, res) => {
  await assemblyRecordRequestsService.deleteAssemblyRecordRequest(Number(req.params.id));
  res.status(204).send();
});

const previewAssemblyRecordRequest = asyncHandler(async (req, res) => {
  const request = await assemblyRecordRequestsService.getAssemblyRecordRequestById(Number(req.params.id));

  res.json({
    code: request.code,
    client: request.client.fullName,
    certificateNumber: request.certificate.certificateNumber,
    preview: `Solicitud ${request.code} basada en certificado ${request.certificate.certificateNumber}`,
  });
});

const previewDeleteAssemblyRecordRequest = asyncHandler(async (req, res) => {
  const preview = await assemblyRecordRequestsService.getAssemblyRecordRequestDeletePreview(Number(req.params.id));
  res.json(preview);
});

const downloadAssemblyRecordRequestPdf = asyncHandler(async (req, res) => {
  const request = await assemblyRecordRequestsService.getAssemblyRecordRequestById(Number(req.params.id));
  const pdfBuffer = await buildAssemblyRecordRequestPdf(request);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="solicitud-acta-${request.code}.pdf"`);
  res.send(pdfBuffer);
});

const downloadAssemblyRecordRequestPdfByFilename = asyncHandler(async (req, res) => {
  const filename = req.params.filename || "";
  const code = filename.replace(/^solicitud-acta-/, "").replace(/\.pdf$/, "");
  const request = await assemblyRecordRequestsService.getAssemblyRecordRequestByCode(code);
  const pdfBuffer = await buildAssemblyRecordRequestPdf(request);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
  res.send(pdfBuffer);
});

module.exports = {
  listAssemblyRecordRequests,
  getAssemblyRecordRequestById,
  createAssemblyRecordRequest,
  updateAssemblyRecordRequest,
  deleteAssemblyRecordRequest,
  previewAssemblyRecordRequest,
  previewDeleteAssemblyRecordRequest,
  downloadAssemblyRecordRequestPdf,
  downloadAssemblyRecordRequestPdfByFilename,
};

const express = require("express");
const clientsController = require("../controllers/clients.controller");
const { authRequired } = require("../../../middlewares/auth.middleware");
const { requireModuleAccess } = require("../../../middlewares/module-access.middleware");

const router = express.Router();

router.use(authRequired, requireModuleAccess("clients"));

router.get("/", clientsController.listClients);
router.get("/search/:document", clientsController.searchByDocument);
router.get("/reniec/:document", clientsController.searchReniec);
router.get("/:id/delete-preview", clientsController.previewDeleteClient);
router.get("/:id", clientsController.getClientById);
router.post("/", clientsController.createClient);
router.put("/:id", clientsController.updateClient);
router.delete("/:id", clientsController.deleteClient);

module.exports = router;

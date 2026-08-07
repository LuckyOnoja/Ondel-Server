"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const project_controller_js_1 = require("./project.controller.js");
const authMiddleware_js_1 = require("../../middleware/authMiddleware.js");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file limit
});
const router = (0, express_1.Router)();
// Require valid auth token for all project operations
router.use(authMiddleware_js_1.requireAuth);
router.get('/', project_controller_js_1.getProjects);
router.post('/', project_controller_js_1.createProject);
router.patch('/:id', project_controller_js_1.renameProject);
router.post('/:id/songs', project_controller_js_1.addSongToProject);
router.post('/:id/vault', project_controller_js_1.addVaultItemToProject);
router.post('/:id/vault/upload', upload.single('file'), project_controller_js_1.uploadVaultFileToProject);
router.delete('/:id/vault/:vaultItemId', project_controller_js_1.deleteVaultItemFromProject);
router.post('/:id/events', project_controller_js_1.addCalendarEventToProject);
exports.default = router;

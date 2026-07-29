"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const waitlistController_js_1 = require("../controllers/waitlistController.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
// Configure local uploads directory for audio demos
const uploadDir = path_1.default.join(process.cwd(), 'uploads', 'demos');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path_1.default.extname(file.originalname) || '.mp3';
        cb(null, `demo-${uniqueSuffix}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max limit for audio demos
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)) {
            cb(null, true);
        }
        else {
            cb(new Error('Only audio files (MP3, WAV, M4A, AAC, FLAC) are supported.'));
        }
    },
});
// --- Public / User Endpoints ---
router.post('/log-step', waitlistController_js_1.logStep);
router.post('/submit', waitlistController_js_1.submitWaitlist);
router.post('/upload-demo', upload.single('demo'), waitlistController_js_1.uploadDemo);
router.get('/strategy/:token', waitlistController_js_1.getStrategyByToken);
router.get('/my-strategy', authMiddleware_js_1.requireAuth, waitlistController_js_1.getMyStrategy);
// --- Admin Endpoints (Guarded by requireAdmin) ---
router.get('/admin/submissions', authMiddleware_js_1.requireAdmin, waitlistController_js_1.getAdminSubmissions);
router.get('/admin/submissions/:id', authMiddleware_js_1.requireAdmin, waitlistController_js_1.getAdminSubmissionById);
router.post('/admin/submissions/:id/strategy', authMiddleware_js_1.requireAdmin, waitlistController_js_1.saveAndDeliverStrategy);
router.post('/admin/submissions/:id/weekly-opportunity', authMiddleware_js_1.requireAdmin, waitlistController_js_1.createWeeklyOpportunity);
router.get('/admin/analytics', authMiddleware_js_1.requireAdmin, waitlistController_js_1.getAnalyticsMetrics);
exports.default = router;

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {
  logStep,
  submitWaitlist,
  uploadDemo,
  getStrategyByToken,
  getMyStrategy,
  getAdminSubmissions,
  getAdminSubmissionById,
  saveAndDeliverStrategy,
  createWeeklyOpportunity,
  getAnalyticsMetrics,
} from '../controllers/waitlistController.js';
import { requireAdmin, requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// Configure local uploads directory for audio demos
const uploadDir = path.join(process.cwd(), 'uploads', 'demos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname) || '.mp3';
    cb(null, `demo-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max limit for audio demos
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.originalname.match(/\.(mp3|wav|m4a|aac|flac|ogg)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, M4A, AAC, FLAC) are supported.'));
    }
  },
});

// --- Public / User Endpoints ---
router.post('/log-step', logStep);
router.post('/submit', submitWaitlist);
router.post('/upload-demo', upload.single('demo'), uploadDemo);
router.get('/strategy/:token', getStrategyByToken);
router.get('/my-strategy', requireAuth, getMyStrategy);

// --- Admin Endpoints (Guarded by requireAdmin) ---
router.get('/admin/submissions', requireAdmin, getAdminSubmissions);
router.get('/admin/submissions/:id', requireAdmin, getAdminSubmissionById);
router.post('/admin/submissions/:id/strategy', requireAdmin, saveAndDeliverStrategy);
router.post('/admin/submissions/:id/weekly-opportunity', requireAdmin, createWeeklyOpportunity);
router.get('/admin/analytics', requireAdmin, getAnalyticsMetrics);

export default router;

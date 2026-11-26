import { Router } from 'express';
import { requireAuth } from '../../middleware/authMiddleware.js';
import { CuratorController } from './curator.controller.js';

const router = Router();

router.get('/directory', CuratorController.listDirectory);
router.get('/me', requireAuth, CuratorController.getMe);
router.post('/register', requireAuth, CuratorController.register);
router.patch('/profile', requireAuth, CuratorController.updateProfile);
router.patch('/submissions/:submissionId', requireAuth, CuratorController.updateSubmission);

export default router;

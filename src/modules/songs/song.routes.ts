import { Router } from 'express';
import multer from 'multer';
import { SongController } from './song.controller.js';
import { requireAuth } from '../../middleware/authMiddleware.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB audio file size limit
});

const router = Router();

router.post('/', requireAuth, upload.single('audioDemo'), SongController.createSong);
router.post('/:id/scrutinize', requireAuth, SongController.scrutinizeSong);
router.get('/user/:userId', requireAuth, SongController.getUserSongs);

router.get('/:id/chat-messages', requireAuth, SongController.getChatMessages);
router.post('/:id/generate-plan', requireAuth, SongController.generatePlan);
router.post('/:id/chat', requireAuth, SongController.chat);
router.post('/:id/publish-calendar', requireAuth, SongController.publishCalendar);
router.patch('/:id/release-date', requireAuth, SongController.changeReleaseDate);
router.patch('/calendar-events/:eventId', requireAuth, SongController.updateCalendarEvent);
router.post('/:id/calendar-events', requireAuth, SongController.createCalendarEvent);

router.get('/:id', requireAuth, SongController.getSongById);

export default router;

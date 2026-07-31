import { Router } from 'express';
import multer from 'multer';
import { SongController } from './song.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB audio file size limit
});

const router = Router();

router.post('/', upload.single('audioDemo'), SongController.createSong);
router.get('/user/:userId', SongController.getUserSongs);
router.get('/:id', SongController.getSongById);

export default router;

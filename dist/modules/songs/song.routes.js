"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const song_controller_js_1 = require("./song.controller.js");
const authMiddleware_js_1 = require("../../middleware/authMiddleware.js");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB audio file size limit
});
const router = (0, express_1.Router)();
router.post('/', authMiddleware_js_1.requireAuth, upload.single('audioDemo'), song_controller_js_1.SongController.createSong);
router.post('/:id/scrutinize', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.scrutinizeSong);
router.get('/user/:userId', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.getUserSongs);
router.get('/:id/chat-messages', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.getChatMessages);
router.post('/:id/generate-plan', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.generatePlan);
router.post('/:id/chat', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.chat);
router.post('/:id/publish-calendar', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.publishCalendar);
router.patch('/:id/release-date', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.changeReleaseDate);
router.patch('/calendar-events/:eventId', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.updateCalendarEvent);
router.post('/:id/calendar-events', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.createCalendarEvent);
router.get('/:id', authMiddleware_js_1.requireAuth, song_controller_js_1.SongController.getSongById);
exports.default = router;

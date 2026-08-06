"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongController = void 0;
const song_service_1 = require("./song.service");
const song_types_1 = require("./song.types");
class SongController {
    static async createSong(req, res) {
        try {
            let bodyData = req.body;
            if (typeof bodyData.subgenres === 'string') {
                try {
                    bodyData.subgenres = JSON.parse(bodyData.subgenres);
                }
                catch {
                    bodyData.subgenres = bodyData.subgenres.split(',').map((s) => s.trim());
                }
            }
            if (typeof bodyData.similarArtists === 'string') {
                try {
                    bodyData.similarArtists = JSON.parse(bodyData.similarArtists);
                }
                catch {
                    bodyData.similarArtists = bodyData.similarArtists.split(',').map((s) => s.trim());
                }
            }
            const validated = song_types_1.CreateSongSchema.parse(bodyData);
            const audioBuffer = req.file ? req.file.buffer : undefined;
            const song = await song_service_1.SongService.createSong(validated, audioBuffer);
            res.status(201).json({ success: true, data: song });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async scrutinizeSong(req, res) {
        try {
            const id = String(req.params.id);
            const updatedSong = await song_service_1.SongService.scrutinizeSong(id);
            res.status(200).json({ success: true, data: updatedSong });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async getUserSongs(req, res) {
        try {
            const userId = String(req.user?.userId || req.user?.id || req.query.userId || req.params.userId || '');
            const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
            if (!userId || userId === 'undefined') {
                res.status(400).json({ success: false, error: 'userId is required' });
                return;
            }
            const songs = await song_service_1.SongService.getUserSongs(userId, projectId);
            res.status(200).json({ success: true, data: songs });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async getSongById(req, res) {
        try {
            const id = String(req.params.id);
            const song = await song_service_1.SongService.getSongById(id);
            res.status(200).json({ success: true, data: song });
        }
        catch (error) {
            res.status(404).json({ success: false, error: error.message || error });
        }
    }
    static async getChatMessages(req, res) {
        try {
            const songId = String(req.params.id);
            const messages = await song_service_1.SongService.getChatMessages(songId);
            res.status(200).json({ success: true, data: messages });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async generatePlan(req, res) {
        try {
            const songId = String(req.params.id);
            const { releaseDate } = req.body;
            const userIdentifier = req.user?.email || 'default_user';
            if (!releaseDate) {
                res.status(400).json({ success: false, error: 'releaseDate is required' });
                return;
            }
            const plan = await song_service_1.SongService.generatePlan(userIdentifier, songId, releaseDate);
            res.status(200).json({ success: true, data: plan });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async chat(req, res) {
        try {
            const songId = String(req.params.id);
            const { prompt } = req.body;
            const userIdentifier = req.user?.email || 'default_user';
            if (!prompt) {
                res.status(400).json({ success: false, error: 'prompt is required' });
                return;
            }
            const reply = await song_service_1.SongService.chat(userIdentifier, songId, prompt);
            res.status(200).json({ success: true, data: reply });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async publishCalendar(req, res) {
        try {
            const songId = String(req.params.id);
            const events = await song_service_1.SongService.publishCalendar(songId);
            res.status(201).json({ success: true, data: events });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async changeReleaseDate(req, res) {
        try {
            const songId = String(req.params.id);
            const { releaseDate } = req.body;
            if (!releaseDate) {
                res.status(400).json({ success: false, error: 'releaseDate is required' });
                return;
            }
            const result = await song_service_1.SongService.changeReleaseDate(songId, releaseDate);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async updateCalendarEvent(req, res) {
        try {
            const eventId = String(req.params.eventId);
            const { completed, title } = req.body;
            const updated = await song_service_1.SongService.updateCalendarEvent(eventId, { completed, title });
            res.status(200).json({ success: true, data: updated });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async createCalendarEvent(req, res) {
        try {
            const songId = String(req.params.id);
            const { title, date, category } = req.body;
            if (!title || !date) {
                res.status(400).json({ success: false, error: 'title and date are required' });
                return;
            }
            const newEvent = await song_service_1.SongService.createCalendarEvent(songId, { title, date, category });
            res.status(201).json({ success: true, data: newEvent });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async deleteSong(req, res) {
        try {
            const songId = String(req.params.id);
            await song_service_1.SongService.deleteSong(songId);
            res.status(200).json({ success: true, message: 'Song and all associated records deleted successfully' });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || 'Failed to delete song' });
        }
    }
}
exports.SongController = SongController;

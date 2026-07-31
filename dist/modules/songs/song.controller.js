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
            const userId = String(req.query.userId || req.params.userId);
            if (!userId || userId === 'undefined') {
                res.status(400).json({ success: false, error: 'userId is required' });
                return;
            }
            const songs = await song_service_1.SongService.getUserSongs(userId);
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
}
exports.SongController = SongController;

import { Request, Response } from 'express';
import { SongService } from './song.service';
import { CreateSongSchema } from './song.types';
import { AuthRequest } from '../../middleware/authMiddleware';

export class SongController {
  static async createSong(req: Request, res: Response): Promise<void> {
    try {
      let bodyData = req.body;
      if (typeof bodyData.subgenres === 'string') {
        try {
          bodyData.subgenres = JSON.parse(bodyData.subgenres);
        } catch {
          bodyData.subgenres = bodyData.subgenres.split(',').map((s: string) => s.trim());
        }
      }
      if (typeof bodyData.similarArtists === 'string') {
        try {
          bodyData.similarArtists = JSON.parse(bodyData.similarArtists);
        } catch {
          bodyData.similarArtists = bodyData.similarArtists.split(',').map((s: string) => s.trim());
        }
      }

      const validated = CreateSongSchema.parse(bodyData);
      const audioBuffer = req.file ? req.file.buffer : undefined;

      const song = await SongService.createSong(validated, audioBuffer);
      res.status(201).json({ success: true, data: song });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async scrutinizeSong(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const updatedSong = await SongService.scrutinizeSong(id);
      res.status(200).json({ success: true, data: updatedSong });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getUserSongs(req: Request, res: Response): Promise<void> {
    try {
      const userId = String((req as any).user?.userId || (req as any).user?.id || req.query.userId || req.params.userId || '');
      const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
      if (!userId || userId === 'undefined') {
        res.status(400).json({ success: false, error: 'userId is required' });
        return;
      }
      const songs = await SongService.getUserSongs(userId, projectId);
      res.status(200).json({ success: true, data: songs });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getSongById(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const song = await SongService.getSongById(id);
      res.status(200).json({ success: true, data: song });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message || error });
    }
  }

  static async getChatMessages(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const messages = await SongService.getChatMessages(songId);
      res.status(200).json({ success: true, data: messages });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async generatePlan(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const { releaseDate } = req.body;
      const userIdentifier = req.user?.email || 'default_user';

      if (!releaseDate) {
        res.status(400).json({ success: false, error: 'releaseDate is required' });
        return;
      }

      const plan = await SongService.generatePlan(userIdentifier, songId, releaseDate);
      res.status(200).json({ success: true, data: plan });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async chat(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const { prompt } = req.body;
      const userIdentifier = req.user?.email || 'default_user';

      if (!prompt) {
        res.status(400).json({ success: false, error: 'prompt is required' });
        return;
      }

      const reply = await SongService.chat(userIdentifier, songId, prompt);
      res.status(200).json({ success: true, data: reply });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async publishCalendar(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const events = await SongService.publishCalendar(songId);
      res.status(201).json({ success: true, data: events });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async changeReleaseDate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const { releaseDate } = req.body;

      if (!releaseDate) {
        res.status(400).json({ success: false, error: 'releaseDate is required' });
        return;
      }

      const result = await SongService.changeReleaseDate(songId, releaseDate);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async updateCalendarEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const eventId = String(req.params.eventId);
      const { completed, title } = req.body;
      const updated = await SongService.updateCalendarEvent(eventId, { completed, title });
      res.status(200).json({ success: true, data: updated });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async createCalendarEvent(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      const { title, date, category } = req.body;
      if (!title || !date) {
        res.status(400).json({ success: false, error: 'title and date are required' });
        return;
      }
      const newEvent = await SongService.createCalendarEvent(songId, { title, date, category });
      res.status(201).json({ success: true, data: newEvent });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async deleteSong(req: AuthRequest, res: Response): Promise<void> {
    try {
      const songId = String(req.params.id);
      await SongService.deleteSong(songId);
      res.status(200).json({ success: true, message: 'Song and all associated records deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || 'Failed to delete song' });
    }
  }
}

import { Request, Response } from 'express';
import { SongService } from './song.service';
import { CreateSongSchema } from './song.types';

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
      if (!userId || userId === 'undefined') {
        res.status(400).json({ success: false, error: 'userId is required' });
        return;
      }
      const songs = await SongService.getUserSongs(userId);
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
}

import { prisma } from '../../config/prisma';
import { CreateSongDTO } from './song.types';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AudioScrutinizerService } from './audio-scrutinizer.service';

export class SongService {
  static async createSong(dto: CreateSongDTO, audioFileBuffer?: Buffer) {
    const { userId, artistName, title, genre, subgenres, spotifyUrl, epkUrl, similarArtists, soundVibe } = dto;

    // 1. Find or create Artist for the user
    let artist = await prisma.artist.findFirst({
      where: { userId, name: artistName },
    });

    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          userId,
          name: artistName,
          genres: [genre, ...(subgenres || [])],
        },
      });
    }

    // 2. Upload audio file demo if buffer provided
    let audioUrl: string | undefined = undefined;
    if (audioFileBuffer) {
      try {
        audioUrl = await CloudinaryService.uploadAudioBuffer(audioFileBuffer, 'song_demos');
      } catch (err: any) {
        console.warn('[SongService] Audio upload to Cloudinary failed, proceeding without audio URL:', err.message);
      }
    }

    // 3. Create Song record
    const song = await prisma.song.create({
      data: {
        artistId: artist.id,
        title,
        genre,
        subgenres: subgenres || [],
        audioUrl,
        epkUrl,
        similarArtists: similarArtists || [],
        soundVibe,
        metadata: {
          spotifyUrl: spotifyUrl || null,
        },
      },
      include: {
        artist: true,
      },
    });

    // 4. Trigger asynchronous 3-Layer AI & Audio Scrutinizer Pipeline
    AudioScrutinizerService.scrutinizeSong(song.id, audioFileBuffer).catch((err) => {
      console.warn('[SongService] Background audio scrutinization failed:', err.message);
    });

    return song;
  }

  static async scrutinizeSong(songId: string) {
    await AudioScrutinizerService.scrutinizeSong(songId);
    return this.getSongById(songId);
  }

  static async getUserSongs(userId: string) {
    const songs = await prisma.song.findMany({
      where: {
        artist: {
          userId,
        },
      },
      include: {
        artist: true,
        campaigns: {
          select: {
            id: true,
            status: true,
            type: true,
            budgetCredits: true,
            consumedCredits: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return songs;
  }

  static async getSongById(songId: string) {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: {
        artist: true,
        campaigns: {
          include: {
            targets: {
              include: {
                lead: {
                  include: {
                    contactPoints: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!song) {
      throw new Error(`Song with ID ${songId} not found`);
    }

    return song;
  }
}

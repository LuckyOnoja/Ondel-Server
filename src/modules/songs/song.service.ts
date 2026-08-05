import { prisma } from '../../config/prisma';
import { CreateSongDTO } from './song.types';
import { generateSongSlug } from '../../utils/slugify.js';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AudioScrutinizerService } from './audio-scrutinizer.service';
import { AIService } from '../../services/ai.service.js';
import { creditsService } from '../credits/credits.service.js';

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

    // 2. Upload audio file demo if buffer provided and no frontend direct audioUrl
    let audioUrl: string | undefined = dto.audioUrl;
    if (!audioUrl && audioFileBuffer) {
      try {
        audioUrl = await CloudinaryService.uploadAudioBuffer(audioFileBuffer, 'song_demos');
      } catch (err: any) {
        console.warn('[SongService] Audio upload to Cloudinary failed, proceeding without audio URL:', err.message);
      }
    }

    // 3. Compute unique song gradient if projectId exists
    let songGradient: string | undefined = undefined;
    if (dto.projectId) {
      const projectSongs = await prisma.song.findMany({
        where: { projectId: dto.projectId },
        select: { gradient: true },
      });
      const usedGradients = new Set(projectSongs.map((s) => s.gradient).filter(Boolean));
      const PRESETS = [
        'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #3B82F6 100%)',
        'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)',
        'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)',
        'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #F97316 100%)',
        'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%)'
      ];
      const available = PRESETS.find((g) => !usedGradients.has(g));
      songGradient = available || PRESETS[projectSongs.length % PRESETS.length];
    }

    // 3.5 Generate unique human-readable song slug
    let slug = generateSongSlug(title);
    let existingSlug = await prisma.song.findUnique({ where: { slug } });
    while (existingSlug) {
      slug = generateSongSlug(title);
      existingSlug = await prisma.song.findUnique({ where: { slug } });
    }

    // 4. Create Song record
    const song = await prisma.song.create({
      data: {
        artistId: artist.id,
        projectId: dto.projectId || null,
        title,
        slug,
        genre,
        subgenres: subgenres || [],
        audioUrl,
        epkUrl,
        similarArtists: similarArtists || [],
        soundVibe,
        gradient: songGradient || null,
        metadata: {
          spotifyUrl: spotifyUrl || null,
          userBpm: dto.bpm || null,
          estimatedBpm: dto.bpm || null,
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

  static async getSongById(songIdOrSlug: string) {
    let song = await prisma.song.findUnique({
      where: { id: songIdOrSlug },
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
      song = await prisma.song.findUnique({
        where: { slug: songIdOrSlug },
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
    }

    if (!song) {
      throw new Error(`Song with identifier ${songIdOrSlug} not found`);
    }

    return song;
  }

  static async getChatMessages(songId: string) {
    return prisma.chatMessage.findMany({
      where: { songId },
      orderBy: { createdAt: 'asc' },
    });
  }

  static async generatePlan(userIdOrEmail: string, songId: string, targetReleaseDate: string) {
    const song = await this.getSongById(songId);
    
    // Deduct 1 credit
    const success = await creditsService.deductCredit(
      userIdOrEmail,
      1,
      `Generated AI release plan for "${song.title}"`
    );
    if (!success) {
      throw new Error('Insufficient credit balance');
    }

    // Call AI to generate campaign plan & events list
    const plan = await AIService.generateReleasePlan(
      song.title,
      song.artist?.name || 'Artist',
      song.genre || 'Afrobeats',
      targetReleaseDate
    );

    // Save AI plan into chat messages history
    await prisma.chatMessage.create({
      data: {
        songId,
        sender: 'ondie',
        text: plan.rawPlanText,
      },
    });

    // Update song details including target date & cache events list in metadata
    const existingMetadata = (song.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      releasePlanEvents: plan.events,
      targetReleaseDate,
    };

    await prisma.song.update({
      where: { id: songId },
      data: {
        calendarPlanGenerated: false,
        metadata: updatedMetadata,
      },
    });

    return plan;
  }

  static async chat(userIdOrEmail: string, songId: string, prompt: string) {
    const song = await this.getSongById(songId);

    // Deduct 1 credit
    const success = await creditsService.deductCredit(
      userIdOrEmail,
      1,
      `AI Chat query: "${prompt.slice(0, 30)}..."`
    );
    if (!success) {
      throw new Error('Insufficient credit balance');
    }

    // Get chat messages log
    const history = await this.getChatMessages(songId);
    const formattedHistory = history.map((h) => ({ sender: h.sender, text: h.text }));

    // Call AI
    const responseText = await AIService.chatAboutSong(
      song.title,
      song.artist?.name || 'Artist',
      (song.metadata as any)?.targetReleaseDate || new Date().toISOString().split('T')[0],
      formattedHistory,
      prompt
    );

    // Save User message & AI response
    await prisma.chatMessage.create({
      data: {
        songId,
        sender: 'user',
        text: prompt,
      },
    });

    const aiMsg = await prisma.chatMessage.create({
      data: {
        songId,
        sender: 'ondie',
        text: responseText,
      },
    });

    return aiMsg;
  }

  static async publishCalendar(songId: string) {
    const song = await this.getSongById(songId);
    if (!song.projectId) {
      throw new Error('Song must belong to a project to publish calendar');
    }

    const metadata = (song.metadata as any) || {};
    const events: any[] = metadata.releasePlanEvents || [];

    if (events.length === 0) {
      throw new Error('No generated AI plan found for this song. Please generate plan first.');
    }

    const targetDateStr = metadata.targetReleaseDate || new Date().toISOString().split('T')[0];
    const targetDate = new Date(targetDateStr);

    const createdEvents = [];
    for (const evt of events) {
      const eventDate = new Date(targetDate);
      eventDate.setDate(targetDate.getDate() + Number(evt.offsetDays));

      const dbEvent = await prisma.calendarEvent.create({
        data: {
          projectId: song.projectId,
          songId: song.id,
          title: evt.title,
          date: eventDate,
          category: evt.category || 'Promo',
          completed: false,
          songTitle: song.title,
        },
      });
      createdEvents.push(dbEvent);
    }

    // Mark calendar plan as generated/published for this song
    await prisma.song.update({
      where: { id: songId },
      data: {
        calendarPlanGenerated: true,
      },
    });

    return createdEvents;
  }

  static async changeReleaseDate(songId: string, newReleaseDate: string) {
    const song = await this.getSongById(songId);
    const metadata = (song.metadata as any) || {};
    const oldReleaseDateStr = metadata.targetReleaseDate || song.createdAt.toISOString().split('T')[0];

    // Update release date in metadata
    const updatedMetadata = {
      ...metadata,
      targetReleaseDate: newReleaseDate,
    };

    await prisma.song.update({
      where: { id: songId },
      data: {
        metadata: updatedMetadata,
      },
    });

    // Shift existing calendar tasks relative to date difference!
    const oldTime = new Date(oldReleaseDateStr).getTime();
    const newTime = new Date(newReleaseDate).getTime();
    const diffDays = Math.round((newTime - oldTime) / (1000 * 60 * 60 * 24));

    if (diffDays !== 0) {
      const songEvents = await prisma.calendarEvent.findMany({
        where: { songId },
      });

      for (const evt of songEvents) {
        const currentEventDate = new Date(evt.date);
        currentEventDate.setDate(currentEventDate.getDate() + diffDays);

        await prisma.calendarEvent.update({
          where: { id: evt.id },
          data: {
            date: currentEventDate,
          },
        });
      }
    }

    return { success: true, diffDays };
  }

  static async updateCalendarEvent(eventId: string, data: { completed?: boolean; title?: string }) {
    return prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        completed: data.completed !== undefined ? data.completed : undefined,
        title: data.title !== undefined ? data.title : undefined,
      },
    });
  }

  static async createCalendarEvent(songId: string, data: { title: string; date: string; category?: string }) {
    const song = await this.getSongById(songId);
    if (!song.projectId) {
      throw new Error('Song must belong to a project to add calendar events');
    }
    const [y, m, d] = data.date.split('-').map(Number);
    const eventDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));

    return prisma.calendarEvent.create({
      data: {
        projectId: song.projectId,
        songId: song.id,
        title: data.title,
        date: eventDate,
        category: data.category || 'Promo',
        completed: false,
        songTitle: song.title,
      },
    });
  }
}

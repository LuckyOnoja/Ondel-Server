"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SongService = void 0;
const prisma_1 = require("../../config/prisma");
const cloudinary_service_1 = require("../../services/cloudinary.service");
class SongService {
    static async createSong(dto, audioFileBuffer) {
        const { userId, artistName, title, genre, subgenres, spotifyUrl, epkUrl, similarArtists, soundVibe } = dto;
        // 1. Find or create Artist for the user
        let artist = await prisma_1.prisma.artist.findFirst({
            where: { userId, name: artistName },
        });
        if (!artist) {
            artist = await prisma_1.prisma.artist.create({
                data: {
                    userId,
                    name: artistName,
                    genres: [genre, ...(subgenres || [])],
                },
            });
        }
        // 2. Upload audio file demo if buffer provided
        let audioUrl = undefined;
        if (audioFileBuffer) {
            try {
                audioUrl = await cloudinary_service_1.CloudinaryService.uploadAudioBuffer(audioFileBuffer, 'song_demos');
            }
            catch (err) {
                console.warn('[SongService] Audio upload to Cloudinary failed, proceeding without audio URL:', err.message);
            }
        }
        // 3. Create Song record
        const song = await prisma_1.prisma.song.create({
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
        return song;
    }
    static async getUserSongs(userId) {
        const songs = await prisma_1.prisma.song.findMany({
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
    static async getSongById(songId) {
        const song = await prisma_1.prisma.song.findUnique({
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
exports.SongService = SongService;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = require("../config/prisma.js");
const router = (0, express_1.Router)();
/**
 * Public route to resolve a track or vault item for public listening page
 * GET /api/v1/public/listen?song=him-sk.mp3 (or slug/id)
 */
router.get('/listen', async (req, res) => {
    try {
        const query = String(req.query.song || req.query.image || req.query.video || req.query.slug || req.query.id || '').trim();
        if (!query) {
            res.status(400).json({ success: false, message: 'Missing media query parameter (song, image, or video)' });
            return;
        }
        // 1. Check VaultItem by slug or id
        const vaultItem = await prisma_js_1.prisma.vaultItem.findFirst({
            where: {
                OR: [
                    { slug: query },
                    { id: query },
                    { name: query },
                ],
            },
            include: {
                project: {
                    include: {
                        user: true,
                    },
                },
            },
        });
        if (vaultItem) {
            let mediaType = 'audio';
            if (vaultItem.type === 'artwork' || Boolean(vaultItem.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i))) {
                mediaType = 'image';
            }
            else if (Boolean(vaultItem.name.match(/\.(mp4|mov|webm|mkv|avi)$/i))) {
                mediaType = 'video';
            }
            res.status(200).json({
                success: true,
                track: {
                    id: vaultItem.id,
                    title: vaultItem.name,
                    slug: vaultItem.slug || vaultItem.id,
                    fileUrl: vaultItem.fileUrl || '',
                    mediaType,
                    artistName: vaultItem.project?.user?.name || vaultItem.project?.name || 'Independent Artist',
                    projectName: vaultItem.project?.name,
                    type: vaultItem.type,
                    size: vaultItem.size,
                    uploadedAt: vaultItem.uploadedAt,
                },
            });
            return;
        }
        // 2. Fallback: Check Song by slug or id
        const song = await prisma_js_1.prisma.song.findFirst({
            where: {
                OR: [
                    { slug: query },
                    { id: query },
                    { title: query },
                ],
            },
            include: {
                artist: true,
            },
        });
        if (song) {
            res.status(200).json({
                success: true,
                track: {
                    id: song.id,
                    title: song.title,
                    slug: song.slug || song.id,
                    fileUrl: song.audioUrl || 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3',
                    artistName: song.artist?.name || 'Independent Artist',
                    bpm: song.bpm,
                    genre: song.genre,
                    uploadedAt: song.createdAt,
                },
            });
            return;
        }
        res.status(404).json({ success: false, message: 'Track not found' });
    }
    catch (error) {
        console.error('[public/listen error]:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving track' });
    }
});
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectService = exports.ProjectService = exports.GRADIENT_PRESETS = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_js_1 = require("../../config/prisma.js");
const slugify_js_1 = require("../../utils/slugify.js");
const audio_scrutinizer_service_js_1 = require("../songs/audio-scrutinizer.service.js");
const cloudinary_js_1 = require("../../config/cloudinary.js");
const cloudinary_service_js_1 = require("../../services/cloudinary.service.js");
exports.GRADIENT_PRESETS = [
    'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #3B82F6 100%)', // Neon Violet Glow
    'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)', // Electric Cyan Mint
    'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)', // Solar Ember Fire
    'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #F97316 100%)', // Sunset Coral Flare
    'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%)', // Galactic Indigo
    'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)', // Ocean Sky Blue
    'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)', // Tropical Pink Gold
    'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)', // Mint Spark
    'linear-gradient(135deg, #FF0844 0%, #FFB199 100%)', // Crimson Rose
    'linear-gradient(135deg, #F83600 0%, #FE8C00 100%)', // Tangerine Blaze
    'linear-gradient(135deg, #B224EF 0%, #7579FF 100%)', // Deep Purple Velvet
    'linear-gradient(135deg, #9796F0 0%, #FBC7D4 100%)', // Pastel Amethyst
    'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)', // Sapphire Flash
    'linear-gradient(135deg, #F77062 0%, #FE5196 100%)', // Electric Peach
    'linear-gradient(135deg, #A8E063 0%, #56AB2F 100%)', // Lime Emerald
    'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)', // Lavender Dusk
    'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)', // Cosmic Fuchsia
    'linear-gradient(135deg, #5EE7DF 0%, #B490CA 100%)', // Turquoise Dream
    'linear-gradient(135deg, #C33764 0%, #1D2671 100%)', // Midnight Ruby
    'linear-gradient(135deg, #F12711 0%, #F5AF19 100%)', // Flare Amber
];
class ProjectService {
    /**
     * Helper to map Prisma Project model with relations into clean ProjectDto
     */
    mapToProjectDto(p) {
        return {
            id: p.id,
            name: p.name,
            gradient: p.gradient || exports.GRADIENT_PRESETS[0],
            createdAt: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            releaseTargetDate: p.releaseTargetDate ? new Date(p.releaseTargetDate).toISOString().split('T')[0] : undefined,
            songs: (p.songs || []).map((s, idx) => ({
                id: s.id,
                slug: s.slug || undefined,
                title: s.title,
                artistName: s.artist?.name || 'Artist',
                audioUrl: s.audioUrl || undefined,
                audioFileName: s.audioFileName || (s.metadata ? s.metadata.audioFileName : undefined),
                status: 'Strategy Ready',
                releaseDate: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : undefined,
                campaignsCount: s.campaigns ? s.campaigns.length : 0,
                gradient: s.gradient || exports.GRADIENT_PRESETS[idx % exports.GRADIENT_PRESETS.length],
                bpm: s.bpm || (s.metadata ? s.metadata.estimatedBpm : undefined) || undefined,
                genre: s.genre || undefined,
                subgenres: s.subgenres || [],
                similarArtists: s.similarArtists || [],
                calendarPlanGenerated: s.calendarPlanGenerated || false,
            })),
            vaultItems: (() => {
                const seen = new Set();
                const list = [];
                for (const v of p.vaultItems || []) {
                    const key = `${v.name}-${v.fileUrl || v.id}`;
                    if (seen.has(key))
                        continue;
                    seen.add(key);
                    list.push({
                        id: v.id,
                        slug: v.slug || undefined,
                        name: v.name,
                        type: v.type,
                        size: v.size,
                        uploadedAt: v.uploadedAt ? new Date(v.uploadedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                        fileUrl: v.fileUrl || undefined,
                    });
                }
                return list;
            })(),
            calendarEvents: (p.calendarEvents || []).map((ce) => ({
                id: ce.id,
                title: ce.title,
                date: ce.date ? new Date(ce.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                category: ce.category,
                songTitle: ce.songTitle || undefined,
                songId: ce.songId || undefined,
                completed: ce.completed || false,
            })),
            campaigns: (p.campaigns || []).map((c) => ({
                id: c.id,
                title: c.goal || 'Campaign',
                platform: 'TikTok / Spotify',
                status: c.status || 'Active',
                reach: `${c.budgetCredits || 10} Credits`,
            })),
        };
    }
    /**
     * Get all projects for a given user or user email from PostgreSQL DB
     */
    async getUserProjects(userIdOrEmail) {
        const identifier = userIdOrEmail.toLowerCase().trim();
        let user = await prisma_js_1.prisma.user.findFirst({
            where: {
                OR: [{ id: identifier }, { email: identifier }],
            },
            include: { artists: true },
        });
        if (!user) {
            user = await prisma_js_1.prisma.user.findFirst({
                orderBy: { createdAt: 'desc' },
                include: { artists: true },
            });
        }
        if (!user) {
            return [];
        }
        let projects = await prisma_js_1.prisma.project.findMany({
            where: { userId: user.id },
            include: {
                songs: {
                    include: { campaigns: true, artist: true },
                },
                vaultItems: true,
                calendarEvents: true,
                campaigns: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        // If user has no project in PostgreSQL, auto-create default project for them
        if (projects.length === 0) {
            const defaultProject = await prisma_js_1.prisma.project.create({
                data: {
                    userId: user.id,
                    name: 'Untitled Project',
                    gradient: exports.GRADIENT_PRESETS[0],
                    status: 'ACTIVE',
                },
                include: {
                    songs: { include: { campaigns: true, artist: true } },
                    vaultItems: true,
                    calendarEvents: true,
                    campaigns: true,
                },
            });
            projects = [defaultProject];
        }
        return projects.map((p) => this.mapToProjectDto(p));
    }
    /**
     * Select a unique gradient for a new project for a user
     */
    async getUniqueProjectGradient(userId) {
        const userProjects = await prisma_js_1.prisma.project.findMany({
            where: { userId },
            select: { gradient: true },
        });
        const usedGradients = new Set(userProjects.map((p) => p.gradient));
        const available = exports.GRADIENT_PRESETS.find((g) => !usedGradients.has(g));
        if (available)
            return available;
        return exports.GRADIENT_PRESETS[userProjects.length % exports.GRADIENT_PRESETS.length];
    }
    /**
     * Select a unique gradient for a new song in a project
     */
    async getUniqueSongGradient(projectId) {
        const projectSongs = await prisma_js_1.prisma.song.findMany({
            where: { projectId },
            select: { gradient: true },
        });
        const usedGradients = new Set(projectSongs.map((s) => s.gradient).filter(Boolean));
        const available = exports.GRADIENT_PRESETS.find((g) => !usedGradients.has(g));
        if (available)
            return available;
        return exports.GRADIENT_PRESETS[projectSongs.length % exports.GRADIENT_PRESETS.length];
    }
    /**
     * Create a new project in PostgreSQL DB
     */
    async createProject(userIdOrEmail, name, gradient, initialSongTitle, audioFileName, audioUrl) {
        const identifier = userIdOrEmail.toLowerCase().trim();
        let user = await prisma_js_1.prisma.user.findFirst({
            where: {
                OR: [{ id: identifier }, { email: identifier }],
            },
            include: { artists: true },
        });
        if (!user) {
            user = await prisma_js_1.prisma.user.create({
                data: {
                    email: identifier,
                    name: name ? name.split(' ')[0] : 'Artist',
                    isVerified: true,
                },
                include: { artists: true },
            });
        }
        let artist = user.artists[0];
        if (!artist) {
            artist = await prisma_js_1.prisma.artist.create({
                data: {
                    userId: user.id,
                    name: user.name || 'Artist',
                    genres: ['Afrobeats'],
                },
            });
        }
        const existingUserProjectsCount = await prisma_js_1.prisma.project.count({
            where: { userId: user.id },
        });
        const gradientSignature = gradient || (await this.getUniqueProjectGradient(user.id));
        const projectName = name && name.trim() ? name.trim() : 'Untitled Project';
        const newProject = await prisma_js_1.prisma.project.create({
            data: {
                userId: user.id,
                name: projectName,
                gradient: gradientSignature,
                status: 'ACTIVE',
            },
            include: {
                songs: { include: { campaigns: true, artist: true } },
                vaultItems: true,
                calendarEvents: true,
                campaigns: true,
            },
        });
        // If initial song or audio asset provided, create song & vault item in PostgreSQL connected to project!
        if (initialSongTitle || audioFileName || audioUrl) {
            const songTitle = initialSongTitle ||
                (audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Initial Project Track');
            const songGradient = await this.getUniqueSongGradient(newProject.id);
            let slug = (0, slugify_js_1.generateSongSlug)(songTitle);
            let existingSlug = await prisma_js_1.prisma.song.findUnique({ where: { slug } });
            while (existingSlug) {
                slug = (0, slugify_js_1.generateSongSlug)(songTitle);
                existingSlug = await prisma_js_1.prisma.song.findUnique({ where: { slug } });
            }
            await prisma_js_1.prisma.song.create({
                data: {
                    artistId: artist.id,
                    projectId: newProject.id,
                    title: songTitle,
                    slug,
                    genre: 'Afrobeats',
                    audioUrl: audioUrl || null,
                    gradient: songGradient,
                    metadata: audioFileName ? { audioFileName } : undefined,
                },
            });
            if (audioFileName) {
                await prisma_js_1.prisma.vaultItem.create({
                    data: {
                        projectId: newProject.id,
                        name: audioFileName,
                        type: 'stem',
                        size: 'Master Audio File',
                        fileUrl: audioUrl || null,
                    },
                });
            }
            await prisma_js_1.prisma.calendarEvent.create({
                data: {
                    projectId: newProject.id,
                    title: `${songTitle} Pitching & Release`,
                    date: new Date(Date.now() + 14 * 86400000),
                    category: 'Release',
                    songTitle,
                },
            });
        }
        // Refetch newly created project with all relations populated
        const fullProject = await prisma_js_1.prisma.project.findUnique({
            where: { id: newProject.id },
            include: {
                songs: { include: { campaigns: true, artist: true } },
                vaultItems: true,
                calendarEvents: true,
                campaigns: true,
            },
        });
        return this.mapToProjectDto(fullProject || newProject);
    }
    /**
     * Add a song folder to an existing project in PostgreSQL DB
     */
    async addSongToProject(userIdOrEmail, projectId, songData) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
            include: { user: { include: { artists: true } } },
        });
        if (!project)
            throw new Error('Project not found in database');
        let artist = project.user.artists[0];
        if (!artist) {
            artist = await prisma_js_1.prisma.artist.create({
                data: {
                    userId: project.userId,
                    name: songData.artistName || 'Artist',
                    genres: ['Afrobeats'],
                },
            });
        }
        const songGradient = await this.getUniqueSongGradient(project.id);
        let slug = (0, slugify_js_1.generateSongSlug)(songData.title);
        let existingSlug = await prisma_js_1.prisma.song.findUnique({ where: { slug } });
        while (existingSlug) {
            slug = (0, slugify_js_1.generateSongSlug)(songData.title);
            existingSlug = await prisma_js_1.prisma.song.findUnique({ where: { slug } });
        }
        const createdSong = await prisma_js_1.prisma.song.create({
            data: {
                artistId: artist.id,
                projectId: project.id,
                title: songData.title,
                slug,
                genre: 'Afrobeats',
                audioUrl: songData.audioUrl || null,
                gradient: songGradient,
                metadata: songData.audioFileName ? { audioFileName: songData.audioFileName } : undefined,
            },
        });
        // Trigger background audio A&R analysis if audioUrl is provided
        if (createdSong.audioUrl) {
            audio_scrutinizer_service_js_1.AudioScrutinizerService.scrutinizeSong(createdSong.id).catch((err) => {
                console.warn('[ProjectService] Background scrutinization failed:', err.message);
            });
        }
        return {
            id: createdSong.id,
            slug: createdSong.slug || slug,
            title: createdSong.title,
            artistName: artist.name,
            audioUrl: createdSong.audioUrl || undefined,
            audioFileName: songData.audioFileName,
            status: 'Strategy Ready',
            releaseDate: createdSong.createdAt.toISOString().split('T')[0],
            campaignsCount: 0,
            gradient: createdSong.gradient || songGradient,
        };
    }
    /**
     * Add a vault item to an existing project in PostgreSQL DB
     */
    async addVaultItemToProject(userIdOrEmail, projectId, itemData) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new Error('Project not found in database');
        const itemSlug = (0, slugify_js_1.generateSongSlug)(itemData.name);
        const createdItem = await prisma_js_1.prisma.vaultItem.create({
            data: {
                projectId: project.id,
                name: itemData.name,
                type: itemData.type || 'stem',
                size: itemData.size || 'Unknown size',
                fileUrl: itemData.fileUrl || null,
                slug: itemSlug,
            },
        });
        return {
            id: createdItem.id,
            slug: createdItem.slug || undefined,
            name: createdItem.name,
            type: createdItem.type,
            size: createdItem.size,
            uploadedAt: createdItem.uploadedAt.toISOString().split('T')[0],
            fileUrl: createdItem.fileUrl || undefined,
        };
    }
    /**
     * Directly upload file buffer to Cloudinary or disk, and create VaultItem in DB
     */
    async uploadVaultFileToProject(userIdOrEmail, projectId, fileBuffer, fileName, type = 'master', size) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new Error('Project not found in database');
        let fileUrl = undefined;
        if (fileBuffer && fileName) {
            try {
                const isImg = type === 'artwork' || fileName.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i);
                if (isImg) {
                    fileUrl = await cloudinary_service_js_1.CloudinaryService.uploadProofBuffer(fileBuffer, 'ondel_vault');
                }
                else {
                    fileUrl = await cloudinary_service_js_1.CloudinaryService.uploadAudioBuffer(fileBuffer, 'ondel_vault');
                }
            }
            catch (cdnErr) {
                console.warn('⚠️ [Cloudinary] Server upload fallback to disk:', cdnErr);
                try {
                    const uploadsDir = path_1.default.join(process.cwd(), 'uploads', 'vault');
                    if (!fs_1.default.existsSync(uploadsDir)) {
                        fs_1.default.mkdirSync(uploadsDir, { recursive: true });
                    }
                    const safeName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
                    const diskPath = path_1.default.join(uploadsDir, safeName);
                    fs_1.default.writeFileSync(diskPath, fileBuffer);
                    fileUrl = `http://localhost:8000/uploads/vault/${safeName}`;
                }
                catch (diskErr) {
                    console.error('❌ Disk upload error:', diskErr);
                }
            }
        }
        const itemSlug = (0, slugify_js_1.generateSongSlug)(fileName || 'vault-asset');
        const createdItem = await prisma_js_1.prisma.vaultItem.create({
            data: {
                projectId: project.id,
                name: fileName || 'Uploaded File',
                type: type || 'master',
                size: size || 'Unknown size',
                fileUrl: fileUrl || null,
                slug: itemSlug,
            },
        });
        return {
            id: createdItem.id,
            slug: createdItem.slug || undefined,
            name: createdItem.name,
            type: createdItem.type,
            size: createdItem.size,
            uploadedAt: createdItem.uploadedAt.toISOString().split('T')[0],
            fileUrl: createdItem.fileUrl || undefined,
        };
    }
    extractCloudinaryPublicId(url) {
        try {
            const uploadIndex = url.indexOf('/upload/');
            if (uploadIndex === -1)
                return null;
            let path = url.substring(uploadIndex + 8);
            if (path.startsWith('v') && path.includes('/')) {
                const slashIndex = path.indexOf('/');
                path = path.substring(slashIndex + 1);
            }
            const lastDotIndex = path.lastIndexOf('.');
            const publicId = lastDotIndex !== -1 ? path.substring(0, lastDotIndex) : path;
            return publicId;
        }
        catch (err) {
            return null;
        }
    }
    /**
     * Delete a vault item from an existing project in PostgreSQL DB and purge from Cloudinary CDN if applicable
     */
    async deleteVaultItemFromProject(userIdOrEmail, projectId, vaultItemId) {
        const vaultItem = await prisma_js_1.prisma.vaultItem.findUnique({
            where: { id: vaultItemId },
        });
        if (!vaultItem || vaultItem.projectId !== projectId) {
            throw new Error('Vault item not found in project');
        }
        // If fileUrl is a Cloudinary URL, purge resource from Cloudinary CDN
        if (vaultItem.fileUrl && vaultItem.fileUrl.includes('cloudinary.com')) {
            try {
                const publicId = this.extractCloudinaryPublicId(vaultItem.fileUrl);
                if (publicId && (0, cloudinary_js_1.isCloudinaryConfigured)()) {
                    await cloudinary_js_1.cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => null);
                    await cloudinary_js_1.cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => null);
                    await cloudinary_js_1.cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => null);
                    console.log(`✅ [Cloudinary CDN Purge] Successfully purged publicId "${publicId}"`);
                }
            }
            catch (cdnErr) {
                console.warn('⚠️ [Cloudinary] Soft warning purging vault item resource:', cdnErr);
            }
        }
        await prisma_js_1.prisma.vaultItem.delete({
            where: { id: vaultItemId },
        });
        return true;
    }
    /**
     * Add a calendar event to an existing project in PostgreSQL DB
     */
    async addCalendarEventToProject(userIdOrEmail, projectId, eventData) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new Error('Project not found in database');
        const createdEvent = await prisma_js_1.prisma.calendarEvent.create({
            data: {
                projectId: project.id,
                title: eventData.title,
                date: new Date(eventData.date),
                category: eventData.category || 'Release',
                songTitle: eventData.songTitle || null,
            },
        });
        return {
            id: createdEvent.id,
            title: createdEvent.title,
            date: createdEvent.date.toISOString().split('T')[0],
            category: createdEvent.category,
            songTitle: createdEvent.songTitle || undefined,
        };
    }
    /**
     * Rename an existing project in PostgreSQL DB
     */
    async renameProject(userIdOrEmail, projectId, newName) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
        });
        if (!project)
            throw new Error('Project not found in database');
        const updatedProject = await prisma_js_1.prisma.project.update({
            where: { id: projectId },
            data: { name: newName.trim() || 'Untitled Project' },
            include: {
                songs: { include: { campaigns: true, artist: true } },
                vaultItems: true,
                calendarEvents: true,
                campaigns: true,
            },
        });
        return this.mapToProjectDto(updatedProject);
    }
}
exports.ProjectService = ProjectService;
exports.projectService = new ProjectService();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CuratorService = void 0;
const prisma_js_1 = require("../../config/prisma.js");
const authController_js_1 = require("../../controllers/authController.js");
function slugifyHandle(input) {
    const base = input
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 32);
    return base || 'curator';
}
async function generateUniqueHandle(curatorName, existingUserId) {
    const base = slugifyHandle(curatorName);
    let candidate = base;
    let attempt = 0;
    while (attempt < 20) {
        const existing = await prisma_js_1.prisma.curatorProfile.findUnique({ where: { handle: candidate } });
        if (!existing || existing.userId === existingUserId)
            return candidate;
        attempt += 1;
        candidate = `${base}-${Math.floor(100 + Math.random() * 900)}`;
    }
    return `${base}-${Date.now().toString().slice(-4)}`;
}
function sanitizeStringArray(arr, max = 20) {
    if (!Array.isArray(arr))
        return [];
    return Array.from(new Set(arr
        .map((x) => (typeof x === 'string' ? x.trim() : ''))
        .filter(Boolean))).slice(0, max);
}
function sanitizePlaylists(input) {
    if (!Array.isArray(input))
        return [];
    return input
        .map((p, idx) => {
        if (!p || typeof p !== 'object')
            return null;
        const name = typeof p.name === 'string' ? p.name.trim() : '';
        if (!name)
            return null;
        return {
            id: typeof p.id === 'string' && p.id.trim() ? p.id.trim() : `pl-${Date.now()}-${idx}`,
            name,
            platform: typeof p.platform === 'string' && p.platform.trim() ? p.platform.trim() : 'Spotify',
            url: typeof p.url === 'string' ? p.url.trim() : '',
            followers: Math.max(0, Number(p.followers) || 0),
            genres: sanitizeStringArray(p.genres, 8),
            acceptsSubmissions: p.acceptsSubmissions !== false,
            description: typeof p.description === 'string' ? p.description.trim() : undefined,
        };
    })
        .filter((p) => p !== null);
}
class CuratorService {
    static async getCuratorWorkspace(userId) {
        const user = await prisma_js_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                authProvider: true,
                isVerified: true,
                isAdmin: true,
                isCurator: true,
                role: true,
                curatorProfile: {
                    include: {
                        submissions: {
                            orderBy: { createdAt: 'desc' },
                            take: 100,
                        },
                    },
                },
            },
        });
        if (!user)
            return null;
        const profile = user.curatorProfile;
        const submissions = profile?.submissions ?? [];
        const playlists = sanitizePlaylists(profile?.playlists);
        const stats = {
            totalSubmissions: submissions.length,
            newSubmissions: submissions.filter((s) => s.status === 'NEW').length,
            listeningSubmissions: submissions.filter((s) => s.status === 'LISTENING').length,
            addedSubmissions: submissions.filter((s) => s.status === 'ADDED').length,
            savedSubmissions: submissions.filter((s) => s.status === 'SAVED').length,
            declinedSubmissions: submissions.filter((s) => s.status === 'DECLINED').length,
            playlistsCount: playlists.length,
            totalFollowers: Math.max(profile?.totalFollowers ?? 0, playlists.reduce((sum, p) => sum + (p.followers || 0), 0)),
        };
        return {
            isCurator: Boolean(user.isCurator && profile),
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                authProvider: user.authProvider,
                isVerified: user.isVerified,
                isAdmin: user.isAdmin,
                isCurator: Boolean(user.isCurator && profile),
                role: user.role,
            },
            profile: profile
                ? {
                    id: profile.id,
                    userId: profile.userId,
                    curatorName: profile.curatorName,
                    handle: profile.handle,
                    organization: profile.organization,
                    bio: profile.bio,
                    country: profile.country,
                    city: profile.city,
                    platforms: profile.platforms,
                    genres: profile.genres,
                    moods: profile.moods,
                    playlists,
                    totalFollowers: stats.totalFollowers,
                    acceptsSubmissions: profile.acceptsSubmissions,
                    responseTime: profile.responseTime,
                    guidelines: profile.guidelines,
                    socialLinks: profile.socialLinks,
                    verified: profile.verified,
                    createdAt: profile.createdAt,
                    updatedAt: profile.updatedAt,
                }
                : null,
            stats,
            submissions,
        };
    }
    static async registerCurator(userId, input) {
        const curatorName = input.curatorName?.trim();
        if (!curatorName) {
            throw new Error('Curator or brand name is required.');
        }
        const user = await prisma_js_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User account not found.');
        }
        const platforms = sanitizeStringArray(input.platforms, 10);
        const genres = sanitizeStringArray(input.genres, 15);
        const moods = sanitizeStringArray(input.moods, 15);
        let playlists = sanitizePlaylists(input.playlists);
        if (!playlists.length && input.primaryPlaylistName?.trim()) {
            playlists = [
                {
                    id: `pl-${Date.now()}`,
                    name: input.primaryPlaylistName.trim(),
                    platform: input.primaryPlatform?.trim() || platforms[0] || 'Spotify',
                    url: input.primaryPlaylistUrl?.trim() || '',
                    followers: Math.max(0, Number(input.totalFollowers) || 0),
                    genres: genres.slice(0, 4),
                    acceptsSubmissions: input.acceptsSubmissions !== false,
                },
            ];
        }
        const followersFromPlaylists = playlists.reduce((sum, p) => sum + (p.followers || 0), 0);
        const totalFollowers = Math.max(Math.max(0, Number(input.totalFollowers) || 0), followersFromPlaylists);
        const handle = await generateUniqueHandle(curatorName, userId);
        const profile = await prisma_js_1.prisma.curatorProfile.upsert({
            where: { userId },
            create: {
                userId,
                curatorName,
                handle,
                organization: input.organization?.trim() || null,
                bio: input.bio?.trim() || null,
                city: input.city?.trim() || null,
                country: input.country?.trim() || null,
                platforms: platforms.length ? platforms : ['Spotify'],
                genres,
                moods,
                playlists: playlists,
                totalFollowers,
                acceptsSubmissions: input.acceptsSubmissions !== false,
                responseTime: input.responseTime?.trim() || 'Within 5 days',
                guidelines: input.guidelines?.trim() || null,
                socialLinks: (input.socialLinks || {}),
            },
            update: {
                curatorName,
                organization: input.organization?.trim() || null,
                bio: input.bio?.trim() || null,
                city: input.city?.trim() || null,
                country: input.country?.trim() || null,
                platforms: platforms.length ? platforms : ['Spotify'],
                genres,
                moods,
                playlists: playlists,
                totalFollowers,
                acceptsSubmissions: input.acceptsSubmissions !== false,
                responseTime: input.responseTime?.trim() || 'Within 5 days',
                guidelines: input.guidelines?.trim() || null,
                socialLinks: (input.socialLinks || {}),
            },
        });
        const nextRole = user.isAdmin ? 'ADMIN' : 'CURATOR';
        const updatedUser = await prisma_js_1.prisma.user.update({
            where: { id: userId },
            data: {
                isCurator: true,
                role: nextRole,
                name: user.name || curatorName,
            },
        });
        const token = (0, authController_js_1.generateToken)(updatedUser.id, updatedUser.email, updatedUser.authProvider, updatedUser.isAdmin, updatedUser.isCurator, updatedUser.role);
        return {
            token,
            user: {
                id: updatedUser.id,
                email: updatedUser.email,
                name: updatedUser.name,
                avatarUrl: updatedUser.avatarUrl,
                authProvider: updatedUser.authProvider,
                isVerified: updatedUser.isVerified,
                isAdmin: updatedUser.isAdmin,
                isCurator: updatedUser.isCurator,
                role: updatedUser.role,
                curatorProfile: {
                    id: profile.id,
                    curatorName: profile.curatorName,
                    handle: profile.handle,
                },
            },
            profile: {
                ...profile,
                playlists,
            },
        };
    }
    static async updateCuratorProfile(userId, patch) {
        const existing = await prisma_js_1.prisma.curatorProfile.findUnique({ where: { userId } });
        if (!existing) {
            throw new Error('Curator profile not found. Complete curator registration first.');
        }
        const data = {};
        if (typeof patch.curatorName === 'string' && patch.curatorName.trim()) {
            data.curatorName = patch.curatorName.trim();
        }
        if (patch.organization !== undefined)
            data.organization = patch.organization?.trim() || null;
        if (patch.bio !== undefined)
            data.bio = patch.bio?.trim() || null;
        if (patch.city !== undefined)
            data.city = patch.city?.trim() || null;
        if (patch.country !== undefined)
            data.country = patch.country?.trim() || null;
        if (patch.platforms !== undefined)
            data.platforms = sanitizeStringArray(patch.platforms, 10);
        if (patch.genres !== undefined)
            data.genres = sanitizeStringArray(patch.genres, 15);
        if (patch.moods !== undefined)
            data.moods = sanitizeStringArray(patch.moods, 15);
        if (patch.playlists !== undefined) {
            const clean = sanitizePlaylists(patch.playlists);
            data.playlists = clean;
            const sum = clean.reduce((acc, p) => acc + (p.followers || 0), 0);
            if (sum > 0 || patch.totalFollowers === undefined) {
                data.totalFollowers = Math.max(sum, Number(patch.totalFollowers) || 0);
            }
        }
        if (patch.totalFollowers !== undefined && data.totalFollowers === undefined) {
            data.totalFollowers = Math.max(0, Number(patch.totalFollowers) || 0);
        }
        if (typeof patch.acceptsSubmissions === 'boolean')
            data.acceptsSubmissions = patch.acceptsSubmissions;
        if (typeof patch.responseTime === 'string' && patch.responseTime.trim())
            data.responseTime = patch.responseTime.trim();
        if (patch.guidelines !== undefined)
            data.guidelines = patch.guidelines?.trim() || null;
        if (patch.socialLinks !== undefined)
            data.socialLinks = patch.socialLinks;
        const updated = await prisma_js_1.prisma.curatorProfile.update({
            where: { userId },
            data,
        });
        return {
            ...updated,
            playlists: sanitizePlaylists(updated.playlists),
        };
    }
    static async updateSubmission(userId, submissionId, patch) {
        const profile = await prisma_js_1.prisma.curatorProfile.findUnique({ where: { userId } });
        if (!profile)
            throw new Error('Curator profile not found.');
        const existing = await prisma_js_1.prisma.curatorSubmission.findFirst({
            where: { id: submissionId, curatorId: profile.id },
        });
        if (!existing)
            throw new Error('Submission not found.');
        const allowedStatuses = new Set(['NEW', 'LISTENING', 'ADDED', 'SAVED', 'DECLINED']);
        const data = {};
        if (patch.status && allowedStatuses.has(patch.status)) {
            data.status = patch.status;
        }
        if (patch.curatorFeedback !== undefined) {
            data.curatorFeedback = patch.curatorFeedback?.trim() || null;
        }
        if (patch.targetPlaylist !== undefined) {
            data.targetPlaylist = patch.targetPlaylist?.trim() || null;
        }
        return prisma_js_1.prisma.curatorSubmission.update({
            where: { id: submissionId },
            data,
        });
    }
    static async listPublicCurators() {
        const profiles = await prisma_js_1.prisma.curatorProfile.findMany({
            orderBy: [{ acceptsSubmissions: 'desc' }, { verified: 'desc' }, { totalFollowers: 'desc' }, { createdAt: 'desc' }],
            take: 100,
            include: {
                user: {
                    select: {
                        avatarUrl: true,
                        name: true,
                    },
                },
                submissions: {
                    orderBy: { updatedAt: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        songTitle: true,
                        artistName: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                },
            },
        });
        return profiles.map((p) => {
            const playlists = sanitizePlaylists(p.playlists);
            const received = p.submissions.length;
            const repliedSubs = p.submissions.filter((s) => s.status === 'ADDED' || s.status === 'DECLINED');
            const replied = repliedSubs.length;
            let medianDays = 3;
            if (repliedSubs.length > 0) {
                const diffs = repliedSubs
                    .map((s) => Math.max(1, Math.round((s.updatedAt.getTime() - s.createdAt.getTime()) / 86_400_000)))
                    .sort((a, b) => a - b);
                medianDays = diffs[Math.floor(diffs.length / 2)];
            }
            const recentAdds = p.submissions
                .filter((s) => s.status === 'ADDED')
                .slice(0, 5)
                .map((s) => ({
                title: s.songTitle,
                artist: s.artistName,
                addedAt: s.updatedAt.toISOString().slice(0, 10),
            }));
            return {
                id: p.id,
                handle: p.handle,
                curatorName: p.curatorName,
                organization: p.organization,
                photo: p.user?.avatarUrl || null,
                bio: p.bio,
                city: p.city,
                country: p.country,
                platforms: p.platforms,
                genres: p.genres,
                moods: p.moods,
                playlists,
                totalFollowers: Math.max(p.totalFollowers, playlists.reduce((sum, pl) => sum + (pl.followers || 0), 0)),
                acceptsSubmissions: p.acceptsSubmissions,
                responseTime: p.responseTime,
                guidelines: p.guidelines,
                verified: p.verified,
                record: received > 0 ? { replied, received, medianDays } : null,
                recentAdds,
            };
        });
    }
    static async submitPitchToCurator(userId, handle, input) {
        const curator = await prisma_js_1.prisma.curatorProfile.findUnique({ where: { handle } });
        if (!curator) {
            throw new Error('Curator not found.');
        }
        if (!curator.acceptsSubmissions) {
            throw new Error('This curator is not accepting submissions right now.');
        }
        const songTitle = input.songTitle?.trim();
        if (!songTitle) {
            throw new Error('Song title is required to send a pitch.');
        }
        const sender = await prisma_js_1.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, name: true },
        });
        const playlists = sanitizePlaylists(curator.playlists);
        const targetPlaylist = input.targetPlaylist?.trim() || playlists[0]?.name || null;
        // Avoid duplicate active pitch for the same song & curator from the same artist
        const existing = await prisma_js_1.prisma.curatorSubmission.findFirst({
            where: {
                curatorId: curator.id,
                artistUserId: userId,
                songTitle,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (existing) {
            return existing;
        }
        return prisma_js_1.prisma.curatorSubmission.create({
            data: {
                curatorId: curator.id,
                artistUserId: userId,
                artistName: input.artistName?.trim() || sender?.name || sender?.email?.split('@')[0] || 'Artist',
                artistEmail: sender?.email || null,
                songTitle,
                genre: input.genre?.trim() || null,
                pitchNote: input.pitchNote?.trim() || null,
                audioUrl: input.audioUrl?.trim() || null,
                spotifyUrl: input.spotifyUrl?.trim() || null,
                appleMusicUrl: input.appleMusicUrl?.trim() || null,
                targetPlaylist,
                status: 'NEW',
            },
        });
    }
    static async getArtistPitches(userId) {
        const subs = await prisma_js_1.prisma.curatorSubmission.findMany({
            where: { artistUserId: userId },
            orderBy: { createdAt: 'desc' },
            include: {
                curator: {
                    select: {
                        handle: true,
                        curatorName: true,
                        playlists: true,
                    },
                },
            },
        });
        return subs.map((s) => {
            const playlists = sanitizePlaylists(s.curator.playlists);
            return {
                id: s.id,
                curatorHandle: s.curator.handle,
                curatorName: s.curator.curatorName,
                targetPlaylist: s.targetPlaylist || playlists[0]?.name || s.curator.curatorName,
                songTitle: s.songTitle,
                status: s.status,
                curatorFeedback: s.curatorFeedback,
                createdAt: s.createdAt.toISOString(),
                updatedAt: s.updatedAt.toISOString(),
            };
        });
    }
    static async withdrawPitch(userId, submissionId) {
        const existing = await prisma_js_1.prisma.curatorSubmission.findFirst({
            where: { id: submissionId, artistUserId: userId },
        });
        if (!existing) {
            throw new Error('Pitch not found.');
        }
        if (existing.status === 'ADDED' || existing.status === 'DECLINED') {
            throw new Error('This pitch has already been reviewed by the curator.');
        }
        await prisma_js_1.prisma.curatorSubmission.delete({ where: { id: existing.id } });
        return { id: existing.id };
    }
}
exports.CuratorService = CuratorService;

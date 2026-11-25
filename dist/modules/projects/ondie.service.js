"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OndieService = void 0;
const axios_1 = __importDefault(require("axios"));
const prisma_js_1 = require("../../config/prisma.js");
const env_js_1 = require("../../config/env.js");
const spotify_service_js_1 = require("../../services/spotify.service.js");
const VALID_PLATFORMS = new Set(['instagram', 'tiktok', 'youtube', 'threads', 'x', 'spotify']);
const VALID_KINDS = new Set(['post', 'video', 'conversation', 'ads', 'pitch']);
function toIsoDate(value) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))
        return value.slice(0, 10);
    const d = new Date(value);
    if (Number.isNaN(d.getTime()))
        return new Date().toISOString().split('T')[0];
    return d.toISOString().split('T')[0];
}
function addDaysIso(iso, offset) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + offset, 12, 0, 0));
    return dt.toISOString().split('T')[0];
}
function daysBetweenIso(fromIso, toIso) {
    const a = new Date(`${fromIso}T12:00:00Z`).getTime();
    const b = new Date(`${toIso}T12:00:00Z`).getTime();
    return Math.round((b - a) / 86_400_000);
}
function sanitizePlan(raw, todayIso, releaseIso) {
    const summary = typeof raw?.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : 'A tailored release plan built from your project details and release date.';
    const rawItems = Array.isArray(raw?.items) ? raw.items : [];
    const items = [];
    for (const item of rawItems) {
        if (!item || typeof item !== 'object')
            continue;
        const title = String(item.title || '').trim().slice(0, 80);
        if (!title)
            continue;
        let date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)
            ? item.date.slice(0, 10)
            : releaseIso || addDaysIso(todayIso, 7);
        if (date < todayIso)
            date = todayIso;
        const kind = VALID_KINDS.has(item.kind) ? item.kind : 'post';
        const rawPlatforms = Array.isArray(item.platforms) ? item.platforms : [];
        const platforms = rawPlatforms
            .map((p) => String(p).toLowerCase().trim())
            .filter((p) => VALID_PLATFORMS.has(p));
        if (platforms.length === 0) {
            platforms.push(kind === 'pitch' ? 'spotify' : kind === 'video' ? 'tiktok' : 'instagram');
        }
        const why = typeof item.why === 'string' && item.why.trim()
            ? item.why.trim()
            : 'Scheduled to build momentum for your release.';
        items.push({
            date,
            title,
            kind,
            platforms: [...new Set(platforms)],
            why,
            ...(typeof item.caption === 'string' && item.caption.trim() ? { caption: item.caption.trim() } : {}),
            ...(typeof item.songTitle === 'string' && item.songTitle.trim() ? { songTitle: item.songTitle.trim().slice(0, 80) } : {}),
        });
    }
    items.sort((a, b) => a.date.localeCompare(b.date));
    return { summary, items };
}
function sanitizeStoryboard(raw, fallbackTitle) {
    const shots = Array.isArray(raw?.shots)
        ? raw.shots
            .filter((s) => s && typeof s === 'object')
            .map((s, i) => ({
            start: Number.isFinite(Number(s.start)) ? Number(s.start) : i * 3,
            end: Number.isFinite(Number(s.end)) ? Number(s.end) : (i + 1) * 3,
            shot: String(s.shot || '').trim() || 'Performance close-up.',
            text: String(s.text || '').trim(),
        }))
        : [];
    return {
        title: String(raw?.title || fallbackTitle).trim().slice(0, 60),
        hook: String(raw?.hook || 'Visual hook synced to your chorus.').trim(),
        section: String(raw?.section || 'Chorus').trim(),
        length: [7, 15, 30].includes(Number(raw?.length)) ? Number(raw.length) : 15,
        shots: shots.length ? shots : [{ start: 0, end: 15, shot: 'Film yourself performing the hook in natural lighting.', text: fallbackTitle }],
        caption: String(raw?.caption || `${fallbackTitle} — out soon.`).trim(),
    };
}
function normalizeIdeaKey(s) {
    return s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function sanitizeContentIdeas(raw, usedKeys, fallbackVibe) {
    const vibe = String(raw?.vibe || fallbackVibe || 'Your song vibe').trim().slice(0, 80);
    const intro = typeof raw?.intro === 'string' && raw.intro.trim()
        ? raw.intro.trim()
        : 'Pick the angle that feels most natural to shoot today — I’ll break down the full setup and acting for it.';
    const rawIdeas = Array.isArray(raw?.ideas) ? raw.ideas : [];
    const ideas = [];
    const batchSeen = new Set();
    const stamp = Date.now();
    for (let i = 0; i < rawIdeas.length; i++) {
        const it = rawIdeas[i];
        if (!it || typeof it !== 'object')
            continue;
        const title = String(it.title || '').trim().slice(0, 90);
        const hook = String(it.hook || '').trim().slice(0, 220);
        if (!title || !hook)
            continue;
        const key = normalizeIdeaKey(title);
        if (!key || batchSeen.has(key) || usedKeys.has(key))
            continue;
        batchSeen.add(key);
        const rawPlatform = String(it.platform || 'tiktok').toLowerCase().trim();
        const platform = VALID_PLATFORMS.has(rawPlatform) ? rawPlatform : 'tiktok';
        const format = String(it.format || 'Short-form clip').trim().slice(0, 48);
        const whyItWorks = String(it.whyItWorks || 'Easy to shoot with your phone and built around the song’s mood.').trim().slice(0, 200);
        ideas.push({
            id: `idea-${stamp}-${ideas.length + 1}`,
            title,
            hook,
            format,
            platform,
            whyItWorks,
        });
    }
    return { vibe, intro, ideas: ideas.slice(0, 10) };
}
async function searchSpotifyPlaylists(query, limit = 6) {
    const token = await spotify_service_js_1.SpotifyService.getAccessToken();
    if (!token)
        return [];
    try {
        const res = await axios_1.default.get('https://api.spotify.com/v1/search', {
            params: { q: query, type: 'playlist', limit: Math.min(Math.max(limit, 1), 10) },
            headers: { Authorization: `Bearer ${token}` },
            timeout: 10000,
        });
        const rawList = (res.data?.playlists?.items || []).filter(Boolean);
        const playlists = [];
        for (const pl of rawList.slice(0, limit)) {
            const description = String(pl.description || '').replace(/<[^>]+>/g, '').trim();
            const mentionsSubmissions = /submit|submission|dm|email|@|submithub|groover|pitch|contact/i.test(description);
            playlists.push({
                id: pl.id,
                name: pl.name || 'Untitled Playlist',
                owner: pl.owner?.display_name || pl.owner?.id || 'Curator',
                url: pl.external_urls?.spotify || `https://open.spotify.com/playlist/${pl.id}`,
                image: pl.images?.[0]?.url || null,
                description,
                tracks: pl.tracks?.total ?? 0,
                followers: typeof pl.followers?.total === 'number' ? pl.followers.total : null,
                lastAddedAt: null,
                mentionsSubmissions,
                source: 'spotify',
            });
        }
        return playlists;
    }
    catch (err) {
        console.warn('[OndieService] Spotify playlist search failed:', err.message);
        return [];
    }
}
const DEEPSEEK_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'propose_release_plan',
            description: 'Propose a concrete, dated release plan for this music project (single, EP, or album). The UI displays it as an interactive editable draft that the artist can tweak and save straight to their calendar.',
            parameters: {
                type: 'object',
                properties: {
                    summary: {
                        type: 'string',
                        description: 'One or two sentences summarizing the overall release strategy.',
                    },
                    items: {
                        type: 'array',
                        description: '8 to 18 concrete dated items spanning from today (or 2–4 weeks before release) through 7 days after release. Do not duplicate events already on the calendar.',
                        items: {
                            type: 'object',
                            properties: {
                                date: {
                                    type: 'string',
                                    description: 'ISO date YYYY-MM-DD, on or after today.',
                                },
                                title: {
                                    type: 'string',
                                    description: 'Concise calendar chip title (ideally <= 42 chars), specific to this project/song.',
                                },
                                kind: {
                                    type: 'string',
                                    enum: ['post', 'video', 'conversation', 'ads', 'pitch'],
                                },
                                platforms: {
                                    type: 'array',
                                    items: {
                                        type: 'string',
                                        enum: ['instagram', 'tiktok', 'youtube', 'threads', 'x', 'spotify'],
                                    },
                                    description: 'Target platforms. Use ["spotify"] for editorial pitches.',
                                },
                                why: {
                                    type: 'string',
                                    description: 'One concise, actionable sentence explaining why this step matters on this day and how to execute it.',
                                },
                                caption: {
                                    type: 'string',
                                    description: 'Optional short draft caption or pitch angle the artist can edit.',
                                },
                                songTitle: {
                                    type: 'string',
                                    description: 'Optional: for a multi-song project (EP/album), the exact song title from the tracklist this item focuses on (omit for whole-project moments).',
                                },
                            },
                            required: ['date', 'title', 'kind', 'platforms', 'why'],
                        },
                    },
                },
                required: ['summary', 'items'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'search_playlists',
            description: 'Search live Spotify playlists matching a genre, mood, or artist scene so the artist can find real playlists to pitch.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Search query combining genre, mood, and scene (e.g., "afrobeats alté late night").',
                    },
                    limit: {
                        type: 'integer',
                        description: 'Number of playlists to fetch (1-8).',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'propose_storyboard',
            description: 'Propose a 9:16 short-form video storyboard (TikTok / Reels / Shorts) tailored to the artist project.',
            parameters: {
                type: 'object',
                properties: {
                    title: { type: 'string', description: 'Working title, max 40 chars.' },
                    hook: { type: 'string', description: 'One-line scroll-stopping concept.' },
                    section: { type: 'string', description: 'Song section, e.g. Chorus, Verse 1, Bridge.' },
                    length: { type: 'integer', enum: [7, 15, 30] },
                    shots: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                start: { type: 'number' },
                                end: { type: 'number' },
                                shot: { type: 'string' },
                                text: { type: 'string' },
                            },
                            required: ['start', 'end', 'shot', 'text'],
                        },
                    },
                    caption: { type: 'string', description: 'Short caption under 150 chars.' },
                },
                required: ['title', 'hook', 'section', 'length', 'shots', 'caption'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'propose_content_ideas',
            description: 'Propose 10 fresh, relatable, everyday-shootable short-form content ideas for this music project once the artist shares the vibe of their song (or asks for a fresh batch of ideas). STRICTLY never repeat or reword any idea already listed in PREVIOUSLY SUGGESTED CONTENT IDEAS.',
            parameters: {
                type: 'object',
                properties: {
                    vibe: {
                        type: 'string',
                        description: 'Short label for the song vibe the artist described (e.g. "Late-night & moody", "High-energy hype").',
                    },
                    intro: {
                        type: 'string',
                        description: 'One short sentence introducing this batch of 10 ideas.',
                    },
                    ideas: {
                        type: 'array',
                        description: 'Exactly 10 distinct, relatable, realistic content ideas an independent artist can film today with just a phone. Vary settings, storytelling angles, POVs, behind-the-scenes, and emotional hooks.',
                        items: {
                            type: 'object',
                            properties: {
                                title: {
                                    type: 'string',
                                    description: 'Crisp, specific idea name (max 65 chars).',
                                },
                                hook: {
                                    type: 'string',
                                    description: 'The opening 3-second visual/text hook or relatable premise viewers immediately connect with.',
                                },
                                format: {
                                    type: 'string',
                                    description: 'Short format tag (e.g. "15s POV Reel", "Car-listen clip", "Lyric breakdown", "Studio raw take", "Storytime").',
                                },
                                platform: {
                                    type: 'string',
                                    enum: ['tiktok', 'instagram', 'youtube', 'threads', 'x'],
                                },
                                whyItWorks: {
                                    type: 'string',
                                    description: 'One concise sentence on why listeners will relate to or replay this.',
                                },
                            },
                            required: ['title', 'hook', 'format', 'platform', 'whyItWorks'],
                        },
                    },
                },
                required: ['vibe', 'intro', 'ideas'],
            },
        },
    },
];
async function streamDeepSeekTurn(apiKey, messages, useTools, onTextDelta, signal) {
    const payload = {
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        stream: true,
    };
    if (useTools) {
        payload.tools = DEEPSEEK_TOOLS;
        payload.tool_choice = 'auto';
    }
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal,
    });
    if (!response.ok || !response.body) {
        const errBody = await response.text().catch(() => '');
        console.error(`[OndieService] Upstream model error ${response.status}:`, errBody.slice(0, 300));
        throw new Error('Ondie couldn’t complete this right now. Please try again.');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    const toolMap = new Map();
    for (;;) {
        const { value, done } = await reader.read();
        if (done)
            break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx).trim();
            buffer = buffer.slice(idx + 1);
            if (!line || !line.startsWith('data:'))
                continue;
            const dataStr = line.slice(5).trim();
            if (dataStr === '[DONE]')
                continue;
            let parsed;
            try {
                parsed = JSON.parse(dataStr);
            }
            catch {
                continue;
            }
            const delta = parsed?.choices?.[0]?.delta;
            if (!delta)
                continue;
            if (typeof delta.content === 'string' && delta.content.length > 0) {
                content += delta.content;
                onTextDelta(delta.content);
            }
            if (Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                    const tcIndex = typeof tc.index === 'number' ? tc.index : 0;
                    const existing = toolMap.get(tcIndex) || { id: '', name: '', arguments: '' };
                    if (tc.id)
                        existing.id = tc.id;
                    if (tc.function?.name)
                        existing.name += tc.function.name;
                    if (tc.function?.arguments)
                        existing.arguments += tc.function.arguments;
                    toolMap.set(tcIndex, existing);
                }
            }
        }
    }
    const toolCalls = [...toolMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v)
        .filter((tc) => tc.name);
    return { content, toolCalls };
}
class OndieService {
    static async loadProjectContext(projectId) {
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                user: { include: { artists: true } },
                songs: { include: { artist: true }, orderBy: { createdAt: 'asc' } },
                vaultItems: { orderBy: { uploadedAt: 'desc' } },
                calendarEvents: { orderBy: { date: 'asc' } },
            },
        });
        if (!project)
            throw new Error('Project not found');
        const todayIso = toIsoDate(new Date());
        const releaseIso = project.releaseTargetDate ? toIsoDate(project.releaseTargetDate) : null;
        const daysToRelease = releaseIso ? daysBetweenIso(todayIso, releaseIso) : null;
        const meta = (project.metadata && typeof project.metadata === 'object' ? project.metadata : {});
        const roles = meta.roles && typeof meta.roles === 'object' ? meta.roles : {};
        const lyrics = typeof meta.lyrics === 'string' && meta.lyrics.trim() ? meta.lyrics.trim() : null;
        const lyricsBySong = meta.lyricsBySong && typeof meta.lyricsBySong === 'object' ? meta.lyricsBySong : {};
        const artistName = project.songs[0]?.artist?.name ||
            project.user?.artists?.[0]?.name ||
            project.user?.name ||
            'Artist';
        const primaryArtist = project.songs[0]?.artist || project.user?.artists?.[0] || null;
        const artistBio = primaryArtist?.bio || null;
        const artistCountry = primaryArtist?.country || null;
        const artistGenres = primaryArtist?.genres?.length ? primaryArtist.genres.join(', ') : null;
        const savedPitchDraft = meta.pitch && typeof meta.pitch === 'object' && typeof meta.pitch.draft === 'string' && meta.pitch.draft.trim()
            ? meta.pitch.draft.trim()
            : null;
        const usedContentIdeas = Array.isArray(meta.usedContentIdeas)
            ? meta.usedContentIdeas.filter((x) => x && typeof x.title === 'string')
            : [];
        const vaultSummary = project.vaultItems.map((v) => {
            const role = roles[v.fileUrl || v.id] || v.type;
            return `- ${v.name} (type: ${v.type}, role: ${role}, size: ${v.size})`;
        });
        // Build a unified, deduplicated tracklist combining `project.songs` and audio tracks in `project.vaultItems`
        const trackList = [];
        const seenAudioUrls = new Set();
        const seenTrackTitles = new Set();
        const lookupTrackLyrics = (keys) => {
            for (const k of keys) {
                if (!k)
                    continue;
                const found = lyricsBySong[k];
                if (typeof found === 'string' && found.trim())
                    return found.trim();
            }
            return undefined;
        };
        for (const s of project.songs) {
            if (s.audioUrl)
                seenAudioUrls.add(s.audioUrl);
            seenTrackTitles.add(s.title.trim().toLowerCase());
            const details = [];
            if (s.genre)
                details.push(`genre: ${s.genre}`);
            if (s.subgenres?.length)
                details.push(`subgenres: ${s.subgenres.join(', ')}`);
            if (s.bpm)
                details.push(`${s.bpm} BPM`);
            if (s.soundVibe)
                details.push(`vibe: ${s.soundVibe}`);
            if (s.similarArtists?.length)
                details.push(`sounds like: ${s.similarArtists.join(', ')}`);
            const audioName = s.metadata?.audioFileName;
            if (audioName)
                details.push(`file: ${audioName}`);
            const trackLyrics = lookupTrackLyrics([s.audioUrl, `song:${s.id}`, s.id, s.title]);
            trackList.push({ title: s.title, details, lyrics: trackLyrics });
        }
        for (const v of project.vaultItems) {
            const role = roles[v.fileUrl || v.id] || v.type;
            const isSongTrack = v.type === 'master' || role === 'master';
            if (!isSongTrack)
                continue;
            if (v.fileUrl && seenAudioUrls.has(v.fileUrl))
                continue;
            const cleanTitle = v.name.replace(/\.[^/.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim() || v.name;
            if (seenTrackTitles.has(cleanTitle.toLowerCase()))
                continue;
            seenTrackTitles.add(cleanTitle.toLowerCase());
            const trackLyrics = lookupTrackLyrics([v.fileUrl, v.id, cleanTitle, v.name]);
            trackList.push({ title: cleanTitle, details: [`vault file: ${v.name}`], lyrics: trackLyrics });
        }
        const songsSummary = trackList.map((t, idx) => {
            const info = t.details.length ? ` | ${t.details.join(' | ')}` : '';
            const lyricNote = t.lyrics ? ` | lyrics saved (${t.lyrics.split('\n').filter(Boolean).length} lines)` : '';
            return `${idx + 1}. "${t.title}"${info}${lyricNote}`;
        });
        const perSongLyricsBlock = trackList
            .filter((t) => t.lyrics)
            .map((t) => `--- Lyrics for "${t.title}" ---\n${t.lyrics.slice(0, 800)}`)
            .join('\n\n');
        const combinedLyricsBlock = perSongLyricsBlock || (lyrics ? `--- Lyrics on file ---\n${lyrics.slice(0, 1200)}` : '');
        const inferredScope = trackList.length === 0
            ? 'No songs uploaded yet (could be a single, EP, or album)'
            : trackList.length === 1
                ? `1 song in the Vault ("${trackList[0].title}")`
                : `Multi-song project with ${trackList.length} tracks in the Vault (${trackList.length >= 7 ? 'album-sized' : 'EP / multi-track project'})`;
        const calendarSummary = project.calendarEvents.map((e) => {
            const d = toIsoDate(e.date);
            const plats = e.platforms?.length ? ` [${e.platforms.join(', ')}]` : '';
            const songNote = e.songTitle && e.songTitle !== project.name ? ` (song: ${e.songTitle})` : '';
            const status = e.postedAt || e.completed ? ' (done)' : '';
            return `- ${d}: ${e.title}${songNote}${plats}${status}`;
        });
        const hasMaster = trackList.length > 0;
        const hasCover = project.vaultItems.some((v) => v.type === 'artwork' || roles[v.fileUrl || v.id] === 'cover');
        const hasSplits = project.vaultItems.some((v) => roles[v.fileUrl || v.id] === 'splits' || /split/i.test(v.name)) || (Array.isArray(meta.skipped) && meta.skipped.includes('splits'));
        const usedIdeasBlock = usedContentIdeas.length
            ? `\nPREVIOUSLY SUGGESTED CONTENT IDEAS FOR "${project.name}" (STRICTLY DO NOT REPEAT OR REWORD ANY OF THESE — every new idea must be genuinely fresh):\n${usedContentIdeas
                .slice(-80)
                .map((it, idx) => `${idx + 1}. ${it.title}${it.hook ? ` — ${it.hook}` : ''}`)
                .join('\n')}`
            : '';
        const systemPrompt = `You are Ondie, the intelligent release manager and creative director inside Ondel — an operating system for independent music artists preparing a release (a single, EP, or album).

LIVE PROJECT CONTEXT (from the artist's database):
- Today's date: ${todayIso}
- Project name: "${project.name}"
- Release shape (inferred from Vault tracks — never force a label): ${inferredScope}
- Artist: ${artistName}${artistCountry ? ` (${artistCountry})` : ''}${artistGenres ? ` · Genres: ${artistGenres}` : ''}
${artistBio ? `- Artist bio: ${artistBio}\n` : ''}- Release date: ${releaseIso ? `${releaseIso} (${daysToRelease === 0 ? 'today!' : daysToRelease > 0 ? `${daysToRelease} days from today` : `${Math.abs(daysToRelease)} days ago`})` : 'Not set yet'}
- Setup readiness: Release date ${releaseIso ? 'SET' : 'MISSING'}, Songs/Audio ${hasMaster ? `${trackList.length} UPLOADED` : 'MISSING'}, Project cover ${hasCover ? 'UPLOADED' : 'MISSING'}, Split sheet ${hasSplits ? 'DONE/NOT NEEDED' : 'MISSING'}
${savedPitchDraft ? `- Editorial pitch on file: "${savedPitchDraft}"` : ''}

TRACKLIST IN THIS PROJECT (${trackList.length} ${trackList.length === 1 ? 'song' : 'songs'}):
${songsSummary.length ? songsSummary.join('\n') : '- None added yet (check Vault files below)'}

FILES IN THE VAULT (${project.vaultItems.length}):
${vaultSummary.length ? vaultSummary.join('\n') : '- Vault is currently empty'}
${combinedLyricsBlock ? `\nLYRICS BY SONG:\n${combinedLyricsBlock}` : ''}

EXISTING CALENDAR EVENTS (${project.calendarEvents.length}):
${calendarSummary.length ? calendarSummary.join('\n') : '- Calendar is currently empty'}${usedIdeasBlock}

HOW TO RESPOND:
1. MULTI-SONG / EP / ALBUM AWARENESS (CRITICAL):
   - A project is a flexible release space: it has a project name and cover image, and can hold 1 song OR multiple songs (an EP or album).
   - If there is ONLY 1 song in TRACKLIST IN THIS PROJECT, you can naturally assume the artist means that song unless they specify otherwise.
   - If there are 2 OR MORE songs in TRACKLIST IN THIS PROJECT, NEVER assume the project is just one song!
     * When the artist asks for track-specific work (content ideas, video hooks, captions, curator pitch, promo angle) WITHOUT naming which song (or saying "the whole project"), briefly list their actual track names and ask which song they want to focus on — or if they want it for the entire "${project.name}" project.
     * When the artist DOES name a specific song from the tracklist, pull that exact song's metadata & lyrics and tailor every detail to that song.
     * When planning a release for a multi-song project, build a cohesive rollout that can highlight focus/lead track(s) AND the full project drop, tagging \`songTitle\` on track-specific plan items.
2. Refer to their real project name ("${project.name}"), real track names, real Vault files, and real release date naturally — never use placeholder names or made-up files.
3. Keep prose concise, sharp, practical, and easy to scan (short paragraphs or a clean numbered list). Avoid markdown headings (#) and excessive bolding (**).
4. WHEN THE ARTIST ASKS TO PLAN THEIR RELEASE, SCHEDULE, ROLLOUT, OR RELEASE WEEK (or asks to revise a proposed plan):
   - Call the \`propose_release_plan\` tool with 8–16 concrete, dated items anchored to ${releaseIso || `a recommended release window starting after ${todayIso}`}.
   - Every item date MUST be on or after ${todayIso}.
   - If the release date is at least 7 days away, include a Spotify editorial pitch (kind: "pitch", platforms: ["spotify"]) at least 7 days before release, and a Countdown Page setup 7+ days before release.
   - Include a Release Day item on ${releaseIso || 'the target release day'} (if not already covered).
   - Never duplicate items already in EXISTING CALENDAR EVENTS.
   - Tailor tasks to what is actually in or missing from their Vault (e.g., if cover art or stems are missing, remind them or schedule prep; if multiple songs exist, reference the real tracks!).
   - After calling \`propose_release_plan\`, give a brief 2-3 sentence overview explaining how the plan fits "${project.name}" and tell the artist they can edit any item below or reply to tweak it before clicking Add to calendar.
5. DAILY CONTENT IDEAS & SETUP COACHING FLOW:
   - If this is a multi-song project (2+ tracks) and the artist hasn't specified which song (or the whole project) yet, ask them which track they want to promote today alongside its vibe.
   - If the artist has not yet described the song's vibe/mood, ask them warmly in 1–2 short sentences what kind of vibe the song gives before generating ideas.
   - Once the artist tells you the song's vibe — OR asks for more / different / fresh content ideas — ALWAYS call \`propose_content_ideas\` with 10 distinct, relatable, everyday-doable content ideas tailored to that exact song (and its lyrics/mood if on file) and vibe.
   - STRICT NON-REPETITION RULE: Never repeat, recycle, or slightly reword ANY idea from PREVIOUSLY SUGGESTED CONTENT IDEAS above or earlier in this chat. Every batch of 10 must explore genuinely fresh scenarios, POVs, emotions, and filming setups that real people connect with.
   - After calling \`propose_content_ideas\`, briefly invite the artist in 1–2 sentences to pick their favorite idea (or ask for 10 completely fresh ones if none click).
   - ONCE THE ARTIST CHOOSES A SPECIFIC IDEA (e.g. "I choose idea #3..."), DO NOT call \`propose_content_ideas\` again. Instead, switch into hands-on creative director mode and give a complete, practical shooting & acting breakdown so they can film it today:
     1. Location & lighting setup (realistic everyday spot, phone placement, framing)
     2. How to act & deliver it (energy, expression, eye contact, body language, lip-sync or silent reaction)
     3. Shot-by-shot timing (0–3s hook, middle moment, closing beat)
     4. Song section to use + exact on-screen text + a natural caption ready to post
     End by asking what part they want to adapt (e.g., their room/lighting, outfit, lyric line, or camera angle) so you can keep refining it together.
6. WHEN THE ARTIST ASKS FOR PLAYLISTS OR CURATORS:
   - Call \`search_playlists\` with a relevant genre/vibe query. Talk only about real returned results; never invent playlists or follower counts.
7. WHEN THE ARTIST EXPLICITLY ASKS FOR A VIDEO STUDIO STORYBOARD:
   - Call \`propose_storyboard\`.
8. Never promise guaranteed streams, virality, or editorial placement — frame submissions honestly as pitches curators review.`;
        return {
            project,
            meta,
            trackList,
            usedContentIdeas,
            todayIso,
            releaseIso,
            daysToRelease,
            artistName,
            systemPrompt,
            contextDetail: `${project.name} · ${trackList.length} ${trackList.length === 1 ? 'song' : 'songs'} · ${releaseIso ? `out ${releaseIso}` : 'date not set'} · ${project.calendarEvents.length} on calendar`,
        };
    }
    static async getProjectChats(projectId) {
        const chats = await prisma_js_1.prisma.projectChat.findMany({
            where: { projectId },
            include: {
                messages: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { updatedAt: 'desc' },
        });
        return chats.map((c) => ({
            id: c.id,
            title: c.title,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            messages: c.messages.map((m) => {
                const payload = (m.payload && typeof m.payload === 'object' ? m.payload : {});
                if (m.role === 'user') {
                    return {
                        id: m.id,
                        role: 'user',
                        text: m.text,
                        attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
                        sentAt: m.createdAt.toISOString(),
                    };
                }
                return {
                    id: m.id,
                    role: 'ondie',
                    text: m.text,
                    blocks: Array.isArray(payload.blocks) ? payload.blocks : m.text ? [{ kind: 'text', text: m.text }] : [],
                    shown: typeof payload.shown === 'number' ? payload.shown : m.text.length,
                    status: 'done',
                    sentAt: m.createdAt.toISOString(),
                    feedback: payload.feedback ?? null,
                    taken: Array.isArray(payload.taken) ? payload.taken : [],
                    playlists: Array.isArray(payload.playlists) ? payload.playlists : undefined,
                    playlistSource: payload.playlistSource ?? undefined,
                    plan: payload.plan ?? undefined,
                    planAdded: Boolean(payload.planAdded),
                    steps: Array.isArray(payload.steps) ? payload.steps : undefined,
                    storyboard: payload.storyboard ?? undefined,
                    contentIdeas: payload.contentIdeas ?? undefined,
                    chosenIdeaId: typeof payload.chosenIdeaId === 'string' ? payload.chosenIdeaId : null,
                };
            }),
        }));
    }
    static async updateChatMessagePayload(projectId, messageId, patch) {
        const msg = await prisma_js_1.prisma.projectChatMessage.findUnique({
            where: { id: messageId },
            include: { chat: true },
        });
        if (!msg || msg.chat.projectId !== projectId) {
            throw new Error('Chat message not found in project');
        }
        const existing = msg.payload && typeof msg.payload === 'object' ? msg.payload : {};
        const updated = await prisma_js_1.prisma.projectChatMessage.update({
            where: { id: messageId },
            data: {
                payload: {
                    ...existing,
                    ...patch,
                },
            },
        });
        return updated;
    }
    static async deleteProjectChat(projectId, chatId) {
        const chat = await prisma_js_1.prisma.projectChat.findFirst({
            where: { id: chatId, projectId },
        });
        if (!chat) {
            throw new Error('Chat not found in project');
        }
        await prisma_js_1.prisma.projectChat.delete({
            where: { id: chatId },
        });
        return true;
    }
    static async streamChat(projectId, input, emit, signal) {
        const apiKey = env_js_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('[OndieService] Missing AI API key in server/.env');
            emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' });
            return;
        }
        const ctx = await this.loadProjectContext(projectId);
        emit({
            type: 'step',
            id: 'context',
            label: 'Read your project, Vault & calendar',
            status: 'done',
            detail: ctx.contextDetail,
        });
        // Ensure or create chat row in PostgreSQL
        let chat = input.chatId
            ? await prisma_js_1.prisma.projectChat.findFirst({
                where: { id: input.chatId, projectId },
                include: { messages: { orderBy: { createdAt: 'asc' } } },
            })
            : null;
        const cleanText = (input.message || '').trim();
        const titleSeed = cleanText.replace(/\s+/g, ' ').slice(0, 78) || `Chat about ${ctx.project.name}`;
        if (!chat) {
            chat = await prisma_js_1.prisma.projectChat.create({
                data: {
                    projectId,
                    title: titleSeed,
                },
                include: { messages: true },
            });
        }
        // Save user message to PostgreSQL
        const userMsg = await prisma_js_1.prisma.projectChatMessage.create({
            data: {
                chatId: chat.id,
                role: 'user',
                text: cleanText,
                payload: {
                    attachments: Array.isArray(input.attachments) ? input.attachments : [],
                },
            },
        });
        // Build message history for DeepSeek from DB (or supplied turns if fresh)
        const historyTurns = [];
        if (chat.messages.length > 0) {
            for (const m of chat.messages) {
                const p = (m.payload && typeof m.payload === 'object' ? m.payload : {});
                if (m.role === 'user') {
                    if (m.text.trim())
                        historyTurns.push({ role: 'user', content: m.text });
                }
                else {
                    let assistantText = m.text || '';
                    if (p.plan?.items?.length) {
                        assistantText += `\n\n[Proposed release plan (${p.plan.items.length} items${p.planAdded ? ', already added to calendar' : ', editable draft'}): ${p.plan.items.map((it) => `${it.date} ${it.title}`).join('; ')}]`;
                    }
                    if (p.contentIdeas?.ideas?.length) {
                        const chosen = p.chosenIdeaId
                            ? p.contentIdeas.ideas.find((it) => it.id === p.chosenIdeaId)
                            : null;
                        assistantText += `\n\n[Suggested ${p.contentIdeas.ideas.length} content ideas for vibe "${p.contentIdeas.vibe}": ${p.contentIdeas.ideas
                            .map((it, i) => `#${i + 1} ${it.title} (${it.hook})`)
                            .join(' | ')}${chosen ? ` — Artist chose: "${chosen.title}"` : ''}]`;
                    }
                    if (assistantText.trim())
                        historyTurns.push({ role: 'assistant', content: assistantText.trim() });
                }
            }
            historyTurns.push({ role: 'user', content: cleanText });
        }
        else if (Array.isArray(input.turns) && input.turns.length > 0) {
            for (const t of input.turns) {
                if (t?.content?.trim()) {
                    historyTurns.push({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content });
                }
            }
        }
        else {
            historyTurns.push({ role: 'user', content: cleanText });
        }
        const attachmentNote = Array.isArray(input.attachments) && input.attachments.length > 0
            ? `\n[Artist attached files in this message: ${input.attachments.map((a) => a.name || 'file').join(', ')}]`
            : '';
        if (attachmentNote && historyTurns.length > 0) {
            historyTurns[historyTurns.length - 1] = {
                ...historyTurns[historyTurns.length - 1],
                content: historyTurns[historyTurns.length - 1].content + attachmentNote,
            };
        }
        const deepseekMessages = [
            { role: 'system', content: ctx.systemPrompt },
            ...historyTurns.slice(-18),
        ];
        const recordedSteps = [
            { id: 'context', label: 'Read your project, Vault & calendar', status: 'done', detail: ctx.contextDetail },
        ];
        let fullText = '';
        let producedPlan;
        let producedPlaylists;
        let producedStoryboard;
        let producedContentIdeas;
        const usedIdeaKeys = new Set(ctx.usedContentIdeas.map((it) => normalizeIdeaKey(it.title)));
        emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'active' });
        try {
            for (let round = 0; round < 3; round++) {
                if (signal?.aborted)
                    return;
                const { content, toolCalls } = await streamDeepSeekTurn(apiKey, deepseekMessages, round < 2, (delta) => {
                    fullText += delta;
                    emit({ type: 'text', delta });
                }, signal);
                if (toolCalls.length === 0)
                    break;
                deepseekMessages.push({
                    role: 'assistant',
                    content: content || null,
                    tool_calls: toolCalls.map((tc) => ({
                        id: tc.id || `call_${round}_${tc.name}`,
                        type: 'function',
                        function: { name: tc.name, arguments: tc.arguments },
                    })),
                });
                for (let i = 0; i < toolCalls.length; i++) {
                    const tc = toolCalls[i];
                    const callId = tc.id || `call_${round}_${tc.name}`;
                    const stepId = `tool-${round}-${i}`;
                    let args = {};
                    try {
                        args = JSON.parse(tc.arguments || '{}');
                    }
                    catch {
                        args = {};
                    }
                    if (tc.name === 'propose_release_plan') {
                        emit({ type: 'step', id: stepId, label: 'Drafting your release plan', status: 'active' });
                        const plan = sanitizePlan(args, ctx.todayIso, ctx.releaseIso);
                        producedPlan = plan;
                        emit({ type: 'plan', plan });
                        const detail = `${plan.items.length} dated items`;
                        emit({ type: 'step', id: stepId, label: 'Drafting your release plan', status: 'done', detail });
                        recordedSteps.push({ id: stepId, label: 'Drafting your release plan', status: 'done', detail });
                        deepseekMessages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({
                                ok: true,
                                itemCount: plan.items.length,
                                note: 'Plan is now displayed to the artist as an editable interactive draft with automatic checks. Summarize it briefly in 2-3 sentences and invite them to edit any item or click Add to calendar.',
                            }),
                        });
                    }
                    else if (tc.name === 'search_playlists') {
                        const q = String(args.query || ctx.project.songs[0]?.genre || 'indie pop').trim();
                        const label = `Searching Spotify for “${q}”`;
                        emit({ type: 'step', id: stepId, label, status: 'active' });
                        const playlists = await searchSpotifyPlaylists(q, Number(args.limit) || 6);
                        if (playlists.length > 0) {
                            producedPlaylists = [...(producedPlaylists || []), ...playlists];
                            emit({ type: 'playlists', playlists, source: 'spotify' });
                        }
                        const detail = playlists.length ? `${playlists.length} Spotify playlists` : 'No matching playlists found';
                        emit({ type: 'step', id: stepId, label, status: 'done', detail });
                        recordedSteps.push({ id: stepId, label, status: 'done', detail });
                        deepseekMessages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({ playlists }),
                        });
                    }
                    else if (tc.name === 'propose_storyboard') {
                        emit({ type: 'step', id: stepId, label: 'Drafting video storyboard', status: 'active' });
                        const sb = sanitizeStoryboard(args, ctx.project.name);
                        producedStoryboard = sb;
                        emit({ type: 'storyboard', storyboard: sb });
                        const detail = `${sb.shots.length} shots · ${sb.length}s`;
                        emit({ type: 'step', id: stepId, label: 'Drafting video storyboard', status: 'done', detail });
                        recordedSteps.push({ id: stepId, label: 'Drafting video storyboard', status: 'done', detail });
                        deepseekMessages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({ ok: true, note: 'Storyboard shown to the artist. Briefly describe the concept in 1-2 sentences.' }),
                        });
                    }
                    else if (tc.name === 'propose_content_ideas') {
                        emit({ type: 'step', id: stepId, label: 'Coming up with fresh content ideas', status: 'active' });
                        const batch = sanitizeContentIdeas(args, usedIdeaKeys, cleanText.slice(0, 60));
                        producedContentIdeas = batch;
                        // Immediately persist generated ideas into PostgreSQL project.metadata.usedContentIdeas
                        // so Ondie NEVER repeats them on any future day or chat for this project.
                        if (batch.ideas.length > 0) {
                            const nowIso = new Date().toISOString();
                            const newlyUsed = batch.ideas.map((it) => {
                                usedIdeaKeys.add(normalizeIdeaKey(it.title));
                                return { title: it.title, hook: it.hook, vibe: batch.vibe, createdAt: nowIso };
                            });
                            const nextUsed = [...ctx.usedContentIdeas, ...newlyUsed].slice(-200);
                            ctx.usedContentIdeas.push(...newlyUsed);
                            await prisma_js_1.prisma.project
                                .update({
                                where: { id: projectId },
                                data: {
                                    metadata: {
                                        ...ctx.meta,
                                        usedContentIdeas: nextUsed,
                                    },
                                },
                            })
                                .catch((err) => console.error('[OndieService] Failed to save usedContentIdeas:', err));
                        }
                        emit({ type: 'contentIdeas', contentIdeas: batch });
                        const detail = `${batch.ideas.length} fresh ideas`;
                        emit({ type: 'step', id: stepId, label: 'Coming up with fresh content ideas', status: 'done', detail });
                        recordedSteps.push({ id: stepId, label: 'Coming up with fresh content ideas', status: 'done', detail });
                        deepseekMessages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({
                                ok: true,
                                ideaCount: batch.ideas.length,
                                note: 'The 10 fresh content ideas are now displayed interactively to the artist with Choose buttons and a "Give me 10 different ideas" button. In 1-2 short sentences, invite them to pick one for a full setup & acting breakdown or ask for another batch.',
                            }),
                        });
                    }
                    else {
                        deepseekMessages.push({
                            role: 'tool',
                            tool_call_id: callId,
                            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
                        });
                    }
                }
            }
            if (!fullText.trim() && producedPlan) {
                const fallbackNote = `I put together a ${producedPlan.items.length}-item release plan for ${ctx.project.name}. You can edit any date, title, or platform below — or reply with changes — then click Add to calendar when you're ready.`;
                fullText = fallbackNote;
                emit({ type: 'text', delta: fallbackNote });
            }
            else if (!fullText.trim() && producedContentIdeas) {
                const fallbackNote = `Here are ${producedContentIdeas.ideas.length} fresh, relatable content ideas for ${ctx.project.name}. Pick the one you want to shoot today and I’ll walk you through the full setup and how to act it — or tell me if you want 10 completely different ones.`;
                fullText = fallbackNote;
                emit({ type: 'text', delta: fallbackNote });
            }
            emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'done' });
            recordedSteps.push({ id: 'think', label: 'Thinking through your release', status: 'done' });
            // Persist assistant response in PostgreSQL
            const assistantMsg = await prisma_js_1.prisma.projectChatMessage.create({
                data: {
                    chatId: chat.id,
                    role: 'ondie',
                    text: fullText.trim(),
                    payload: {
                        plan: producedPlan ? producedPlan : undefined,
                        planAdded: false,
                        playlists: producedPlaylists ? producedPlaylists : undefined,
                        playlistSource: producedPlaylists?.length ? 'spotify' : undefined,
                        storyboard: producedStoryboard ? producedStoryboard : undefined,
                        contentIdeas: producedContentIdeas ? producedContentIdeas : undefined,
                        chosenIdeaId: null,
                        steps: recordedSteps,
                        feedback: null,
                        taken: [],
                    },
                },
            });
            await prisma_js_1.prisma.projectChat.update({
                where: { id: chat.id },
                data: { updatedAt: new Date() },
            });
            emit({
                type: 'chat',
                chatId: chat.id,
                userMessageId: userMsg.id,
                assistantMessageId: assistantMsg.id,
            });
            emit({ type: 'done', refused: false });
        }
        catch (err) {
            if (signal?.aborted)
                return;
            console.error('[OndieService streamChat error]:', err);
            emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'error' });
            emit({ type: 'error', error: 'Ondie ran into a problem. Please try again.' });
        }
    }
    static async streamCaptions(projectId, reqBody, emit, signal) {
        const apiKey = env_js_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('[OndieService] Missing AI API key in server/.env');
            emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' });
            return;
        }
        const ctx = await this.loadProjectContext(projectId);
        emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'active' });
        const sectionPrompt = reqBody.sections
            .map((s) => `=== ${s.key}\n(${s.label}${s.limit ? `, max ${s.limit} chars` : ''})`)
            .join('\n');
        const focusedTrack = reqBody.post.songTitle
            ? ctx.trackList.find((t) => t.title.toLowerCase() === reqBody.post.songTitle.trim().toLowerCase())
            : ctx.trackList.length === 1
                ? ctx.trackList[0]
                : undefined;
        const trackContext = focusedTrack
            ? `Specific song for this post: "${focusedTrack.title}"${focusedTrack.lyrics ? `\nLyrics excerpt:\n${focusedTrack.lyrics.slice(0, 500)}` : ''}`
            : ctx.trackList.length > 1
                ? `Tracks in this project: ${ctx.trackList.map((t) => `"${t.title}"`).join(', ')}`
                : '';
        const messages = [
            {
                role: 'system',
                content: `You are Ondie, writing authentic, human, hype-free social captions for independent music artists. No cringe clichés, no hashtag walls. Plain text only.`,
            },
            {
                role: 'user',
                content: `Project: "${ctx.project.name}" by ${ctx.artistName}${ctx.releaseIso ? ` (out ${ctx.releaseIso})` : ''}.
${trackContext ? `${trackContext}\n` : ''}Post: "${reqBody.post.title}" scheduled for ${reqBody.post.when} on ${reqBody.post.platforms.join(', ')}.
Media attached: ${reqBody.post.media || 'none'}.
Existing draft: ${reqBody.post.caption || 'none'}.

Write one caption per section below, starting each section on its own line with EXACTLY "=== <key>" followed by the caption text:
${sectionPrompt}`,
            },
        ];
        try {
            await streamDeepSeekTurn(apiKey, messages, false, (delta) => emit({ type: 'text', delta }), signal);
            emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'done' });
            emit({ type: 'done', refused: false });
        }
        catch (err) {
            if (signal?.aborted)
                return;
            console.error('[OndieService streamCaptions error]:', err);
            emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'error' });
            emit({ type: 'error', error: 'Ondie couldn’t draft captions right now. Please try again.' });
        }
    }
    static async streamEditorialPitch(projectId, reqBody, emit, signal) {
        const apiKey = env_js_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            console.error('[OndieService] Missing AI API key in server/.env');
            emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' });
            return;
        }
        const project = await prisma_js_1.prisma.project.findUnique({
            where: { id: projectId },
            include: {
                user: {
                    include: {
                        artists: {
                            include: {
                                songs: {
                                    orderBy: { createdAt: 'desc' },
                                    take: 10,
                                },
                            },
                        },
                        projects: {
                            orderBy: { updatedAt: 'desc' },
                            take: 6,
                            include: {
                                songs: { take: 5 },
                            },
                        },
                        campaigns: {
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                        },
                        waitlistDraft: true,
                    },
                },
                songs: { include: { artist: true }, orderBy: { createdAt: 'asc' } },
                vaultItems: { orderBy: { uploadedAt: 'desc' } },
                calendarEvents: { orderBy: { date: 'asc' } },
                chats: {
                    orderBy: { updatedAt: 'desc' },
                    take: 3,
                    include: {
                        messages: {
                            where: { role: 'user' },
                            orderBy: { createdAt: 'desc' },
                            take: 6,
                        },
                    },
                },
            },
        });
        if (!project) {
            emit({ type: 'error', error: 'Project not found.' });
            return;
        }
        // Pull any onboarding / waitlist submission matched by email for extra taste/story context
        const waitlistSubmission = project.user?.email
            ? await prisma_js_1.prisma.waitlistSubmission
                .findFirst({
                where: { email: project.user.email },
                orderBy: { createdAt: 'desc' },
            })
                .catch(() => null)
            : null;
        emit({ type: 'step', id: 'pitch', label: 'Reading your song, artist style, and schedule', status: 'active' });
        const todayIso = toIsoDate(new Date());
        const releaseIso = project.releaseTargetDate ? toIsoDate(project.releaseTargetDate) : null;
        const daysToRelease = releaseIso ? daysBetweenIso(todayIso, releaseIso) : null;
        const meta = (project.metadata && typeof project.metadata === 'object' ? project.metadata : {});
        const roles = meta.roles && typeof meta.roles === 'object' ? meta.roles : {};
        const lyricsBySong = meta.lyricsBySong && typeof meta.lyricsBySong === 'object' ? meta.lyricsBySong : {};
        const combinedPerSongLyrics = Object.entries(lyricsBySong)
            .filter(([, text]) => typeof text === 'string' && text.trim())
            .map(([, text]) => text.trim())
            .join('\n\n');
        const lyrics = combinedPerSongLyrics || (typeof meta.lyrics === 'string' && meta.lyrics.trim() ? meta.lyrics.trim() : null);
        const primaryArtist = project.songs[0]?.artist || project.user?.artists?.[0] || null;
        const artistName = primaryArtist?.name || project.user?.name || 'the artist';
        const artistCountry = primaryArtist?.country || null;
        const artistBio = primaryArtist?.bio || null;
        const artistGenres = new Set(primaryArtist?.genres || []);
        // Collect musical DNA across all of the artist's songs & past projects
        const similarArtists = new Set();
        const vibes = [];
        const subgenres = new Set();
        const catalogTitles = [];
        const allSongs = [
            ...project.songs,
            ...(project.user?.artists?.flatMap((a) => a.songs) || []),
            ...(project.user?.projects?.flatMap((p) => p.songs) || []),
        ];
        const seenSongIds = new Set();
        for (const s of allSongs) {
            if (seenSongIds.has(s.id))
                continue;
            seenSongIds.add(s.id);
            if (s.genre)
                artistGenres.add(s.genre);
            for (const sg of s.subgenres || [])
                if (sg)
                    subgenres.add(sg);
            for (const sa of s.similarArtists || [])
                if (sa)
                    similarArtists.add(sa);
            if (s.soundVibe)
                vibes.push(s.soundVibe);
            if (s.projectId !== project.id && s.title)
                catalogTitles.push(`${s.title}${s.genre ? ` (${s.genre})` : ''}`);
        }
        for (const c of project.user?.campaigns || []) {
            for (const g of c.targetGenres || [])
                if (g)
                    artistGenres.add(g);
            for (const sa of c.similarArtists || [])
                if (sa)
                    similarArtists.add(sa);
            if (c.soundVibe)
                vibes.push(c.soundVibe);
        }
        const songsInProject = project.songs.map((s) => {
            const parts = [`"${s.title}"`];
            if (s.genre)
                parts.push(`genre: ${s.genre}`);
            if (s.subgenres?.length)
                parts.push(`subgenres: ${s.subgenres.join(', ')}`);
            if (s.bpm)
                parts.push(`${s.bpm} BPM`);
            if (s.soundVibe)
                parts.push(`vibe/mood: ${s.soundVibe}`);
            if (s.similarArtists?.length)
                parts.push(`sounds like / fans of: ${s.similarArtists.join(', ')}`);
            const audioName = s.metadata?.audioFileName;
            if (audioName)
                parts.push(`master file: ${audioName}`);
            return `- ${parts.join(' | ')}`;
        });
        const vaultLines = project.vaultItems.map((v) => {
            const role = roles[v.fileUrl || v.id] || v.type;
            return `- ${v.name} (${role})`;
        });
        const scheduleLines = project.calendarEvents.slice(0, 14).map((e) => {
            const d = toIsoDate(e.date);
            const plats = e.platforms?.length ? ` [${e.platforms.join(', ')}]` : '';
            return `- ${d}: ${e.title}${plats}${e.why ? ` — ${e.why}` : ''}`;
        });
        const recentArtistNotes = project.chats
            .flatMap((c) => c.messages.map((m) => m.text.trim()))
            .filter((t) => t.length > 10 && !/^plan my release/i.test(t))
            .slice(0, 5);
        const draftData = project.user?.waitlistDraft?.data && typeof project.user.waitlistDraft.data === 'object'
            ? project.user.waitlistDraft.data
            : null;
        const targetLength = reqBody.length === 'short' ? 'short' : 'full';
        const charGoal = targetLength === 'short'
            ? '190 to 270 characters (punchy, ultra-tight, NEVER exceed 290 characters)'
            : '340 to 465 characters (rich, vivid, STRICTLY under 485 characters — Spotify hard-caps editorial pitches at 500 characters)';
        const contextBlock = [
            `Artist: ${artistName}${artistCountry ? ` (based in ${artistCountry})` : ''}`,
            artistBio ? `Artist bio: ${artistBio}` : null,
            artistGenres.size ? `Artist genres / style: ${[...artistGenres].join(', ')}` : null,
            subgenres.size ? `Subgenres: ${[...subgenres].join(', ')}` : null,
            similarArtists.size ? `Sonic references / artists they sound like or love: ${[...similarArtists].join(', ')}` : null,
            vibes.length ? `Sound vibe & mood notes: ${[...new Set(vibes)].join(' ; ')}` : null,
            catalogTitles.length ? `Other songs by this artist: ${catalogTitles.slice(0, 6).join(', ')}` : null,
            `Project being pitched: "${project.name}" (${project.releaseType || 'SINGLE'})`,
            `Today: ${todayIso} | Release date: ${releaseIso || 'Not set yet'}${daysToRelease !== null ? ` (${daysToRelease} days away)` : ''}`,
            songsInProject.length ? `Songs on this release:\n${songsInProject.join('\n')}` : 'Songs on this release: Same as project title.',
            lyrics ? `Lyrics / story excerpt:\n${lyrics.slice(0, 700)}` : null,
            vaultLines.length ? `Vault assets ready:\n${vaultLines.join('\n')}` : null,
            scheduleLines.length ? `Planned release schedule & promo moments:\n${scheduleLines.join('\n')}` : 'Release schedule: No calendar events saved yet.',
            recentArtistNotes.length ? `What the artist recently shared in Ondie chat:\n${recentArtistNotes.map((n) => `- ${n.slice(0, 220)}`).join('\n')}` : null,
            waitlistSubmission?.goldmineAnswer ? `Artist background / story note: ${waitlistSubmission.goldmineAnswer}` : null,
            draftData && Object.keys(draftData).length ? `Artist onboarding notes: ${JSON.stringify(draftData).slice(0, 400)}` : null,
            reqBody.pitchRecord?.length
                ? `Curators already pitched: ${reqBody.pitchRecord.map((p) => p.target).join(', ')}`
                : null,
            reqBody.existingDraft?.trim()
                ? `Artist's current pitch text in the box (use as inspiration or elevate/tighten it into a fresh suggestion): "${reqBody.existingDraft.trim()}"`
                : null,
        ]
            .filter(Boolean)
            .join('\n');
        const messages = [
            {
                role: 'system',
                content: `You are Ondie, writing a Spotify Editorial & playlist curator pitch for an independent artist.

RULES:
- Output ONLY the pitch text itself — no greetings ("Hey editors"), no labels ("Pitch:"), no surrounding quotation marks, no bullet points, no markdown, no hashtags, no emojis.
- Target length: ${charGoal}. NEVER exceed 490 characters.
- Write in natural, vivid, grounded editorial language that playlist curators actually respect:
  1. Immediately anchor the song's sound, instrumentation/mood, and story/emotion (pulling from the artist's real genre, vibe, lyrics, and references).
  2. Mention 1-2 sonic reference points ("for fans of...") ONLY if present in the context or clearly implied by the genre/vibe.
  3. Close with one concrete sentence about the release moment / rollout plan (drawing from their actual release date, vault video/assets, or scheduled promo moments — never invent fake streaming numbers, fake press, or fake label backing).
- Every word must feel tailored to THIS specific artist and THIS specific release.`,
            },
            {
                role: 'user',
                content: `Draft a ${targetLength === 'short' ? 'short, punchy' : 'complete, compelling'} playlist pitch for "${project.name}" using all of this real artist & project context:\n\n${contextBlock}`,
            },
        ];
        try {
            let emitted = 0;
            await streamDeepSeekTurn(apiKey, messages, false, (delta) => {
                // Strip accidental leading/trailing quotes if the model wraps output
                let clean = delta;
                if (emitted === 0)
                    clean = clean.replace(/^["“']/, '');
                emitted += clean.length;
                if (clean)
                    emit({ type: 'text', delta: clean });
            }, signal);
            emit({ type: 'step', id: 'pitch', label: 'Pitch draft ready', status: 'done' });
            emit({ type: 'done', refused: false });
        }
        catch (err) {
            if (signal?.aborted)
                return;
            console.error('[OndieService streamEditorialPitch error]:', err);
            emit({ type: 'step', id: 'pitch', label: 'Drafting pitch with Ondie', status: 'error' });
            emit({ type: 'error', error: 'Ondie couldn’t draft your pitch right now. Please try again.' });
        }
    }
}
exports.OndieService = OndieService;

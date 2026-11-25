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
        throw new Error(`DeepSeek API error ${response.status}${errBody ? `: ${errBody.slice(0, 200)}` : ''}`);
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
        const artistName = project.songs[0]?.artist?.name ||
            project.user?.artists?.[0]?.name ||
            project.user?.name ||
            'Artist';
        const vaultSummary = project.vaultItems.map((v) => {
            const role = roles[v.fileUrl || v.id] || v.type;
            return `- ${v.name} (type: ${v.type}, role: ${role}, size: ${v.size})`;
        });
        const songsSummary = project.songs.map((s) => {
            const parts = [`"${s.title}"`];
            if (s.genre)
                parts.push(`genre: ${s.genre}`);
            if (s.bpm)
                parts.push(`${s.bpm} BPM`);
            if (s.soundVibe)
                parts.push(`vibe: ${s.soundVibe}`);
            if (s.similarArtists?.length)
                parts.push(`sounds like: ${s.similarArtists.join(', ')}`);
            const audioName = s.metadata?.audioFileName;
            if (audioName)
                parts.push(`audio file: ${audioName}`);
            return `- ${parts.join(' | ')}`;
        });
        const calendarSummary = project.calendarEvents.map((e) => {
            const d = toIsoDate(e.date);
            const plats = e.platforms?.length ? ` [${e.platforms.join(', ')}]` : '';
            const status = e.postedAt || e.completed ? ' (done)' : '';
            return `- ${d}: ${e.title}${plats}${status}`;
        });
        const hasMaster = project.vaultItems.some((v) => v.type === 'master' || roles[v.fileUrl || v.id] === 'master') || project.songs.some((s) => Boolean(s.audioUrl));
        const hasCover = project.vaultItems.some((v) => v.type === 'artwork' || roles[v.fileUrl || v.id] === 'cover');
        const hasSplits = project.vaultItems.some((v) => roles[v.fileUrl || v.id] === 'splits' || /split/i.test(v.name)) || (Array.isArray(meta.skipped) && meta.skipped.includes('splits'));
        const systemPrompt = `You are Ondie, the intelligent release manager inside Ondel — an operating system for independent music artists preparing a Single, EP, or Album release.

LIVE PROJECT CONTEXT (from the artist's database):
- Today's date: ${todayIso}
- Project name: "${project.name}" (${project.releaseType || 'SINGLE'})
- Artist: ${artistName}
- Release date: ${releaseIso ? `${releaseIso} (${daysToRelease === 0 ? 'today!' : daysToRelease > 0 ? `${daysToRelease} days from today` : `${Math.abs(daysToRelease)} days ago`})` : 'Not set yet'}
- Setup readiness: Release date ${releaseIso ? 'SET' : 'MISSING'}, Master audio ${hasMaster ? 'UPLOADED' : 'MISSING'}, Cover art ${hasCover ? 'UPLOADED' : 'MISSING'}, Split sheet ${hasSplits ? 'DONE/NOT NEEDED' : 'MISSING'}

TRACKS IN THIS PROJECT (${project.songs.length}):
${songsSummary.length ? songsSummary.join('\n') : '- None added yet (check Vault files below)'}

FILES IN THE VAULT (${project.vaultItems.length}):
${vaultSummary.length ? vaultSummary.join('\n') : '- Vault is currently empty'}
${lyrics ? `\nLYRICS ON FILE:\n${lyrics.slice(0, 1200)}` : ''}

EXISTING CALENDAR EVENTS (${project.calendarEvents.length}):
${calendarSummary.length ? calendarSummary.join('\n') : '- Calendar is currently empty'}

HOW TO RESPOND:
1. You have full awareness of the artist's project, tracks, Vault files, and calendar. Refer to their real project name ("${project.name}"), real songs, real Vault files, and real release date naturally — never use placeholder names or made-up files.
2. Keep prose concise, sharp, practical, and easy to scan (short paragraphs or a clean numbered list). Avoid markdown headings (#) and excessive bolding (**).
3. WHEN THE ARTIST ASKS TO PLAN THEIR RELEASE, SCHEDULE, ROLLOUT, OR RELEASE WEEK (or asks to revise a proposed plan):
   - Call the \`propose_release_plan\` tool with 8–16 concrete, dated items anchored to ${releaseIso || `a recommended release window starting after ${todayIso}`}.
   - Every item date MUST be on or after ${todayIso}.
   - If the release date is at least 7 days away, include a Spotify editorial pitch (kind: "pitch", platforms: ["spotify"]) at least 7 days before release, and a Countdown Page setup 7+ days before release.
   - Include a Release Day item on ${releaseIso || 'the target release day'} (if not already covered).
   - Never duplicate items already in EXISTING CALENDAR EVENTS.
   - Tailor tasks to what is actually in or missing from their Vault (e.g., if cover art or stems are missing, remind them or schedule prep; if songs/stems/audio exist, reference them!).
   - After calling \`propose_release_plan\`, give a brief 2-3 sentence overview explaining how the plan fits "${project.name}" and tell the artist they can edit any item below or reply to tweak it before clicking Add to calendar.
4. WHEN THE ARTIST ASKS FOR PLAYLISTS OR CURATORS:
   - Call \`search_playlists\` with a relevant genre/vibe query. Talk only about real returned results; never invent playlists or follower counts.
5. WHEN THE ARTIST ASKS FOR SHORT-FORM VIDEO / TIKTOK / REEL IDEAS:
   - Call \`propose_storyboard\` when they want a concrete shootable storyboard.
6. Never promise guaranteed streams, virality, or editorial placement — frame submissions honestly as pitches curators review.`;
        return {
            project,
            todayIso,
            releaseIso,
            daysToRelease,
            artistName,
            systemPrompt,
            contextDetail: `${project.name} · ${releaseIso ? `out ${releaseIso}` : 'date not set'} · ${project.vaultItems.length} vault ${project.vaultItems.length === 1 ? 'file' : 'files'} · ${project.calendarEvents.length} on calendar`,
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
            emit({ type: 'error', error: 'DEEPSEEK_API_KEY is missing in server/.env.' });
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
            emit({ type: 'error', error: err?.message || 'Ondie ran into a problem contacting DeepSeek.' });
        }
    }
    static async streamCaptions(projectId, reqBody, emit, signal) {
        const apiKey = env_js_1.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
        if (!apiKey) {
            emit({ type: 'error', error: 'DEEPSEEK_API_KEY is missing in server/.env.' });
            return;
        }
        const ctx = await this.loadProjectContext(projectId);
        emit({ type: 'step', id: 'draft', label: 'Drafting captions with DeepSeek', status: 'active' });
        const sectionPrompt = reqBody.sections
            .map((s) => `=== ${s.key}\n(${s.label}${s.limit ? `, max ${s.limit} chars` : ''})`)
            .join('\n');
        const messages = [
            {
                role: 'system',
                content: `You are Ondie, writing authentic, human, hype-free social captions for independent music artists. No cringe clichés, no hashtag walls. Plain text only.`,
            },
            {
                role: 'user',
                content: `Project: "${ctx.project.name}" by ${ctx.artistName}${ctx.releaseIso ? ` (out ${ctx.releaseIso})` : ''}.
Post: "${reqBody.post.title}" scheduled for ${reqBody.post.when} on ${reqBody.post.platforms.join(', ')}.
Media attached: ${reqBody.post.media || 'none'}.
Existing draft: ${reqBody.post.caption || 'none'}.

Write one caption per section below, starting each section on its own line with EXACTLY "=== <key>" followed by the caption text:
${sectionPrompt}`,
            },
        ];
        try {
            await streamDeepSeekTurn(apiKey, messages, false, (delta) => emit({ type: 'text', delta }), signal);
            emit({ type: 'step', id: 'draft', label: 'Drafting captions with DeepSeek', status: 'done' });
            emit({ type: 'done', refused: false });
        }
        catch (err) {
            if (signal?.aborted)
                return;
            emit({ type: 'step', id: 'draft', label: 'Drafting captions with DeepSeek', status: 'error' });
            emit({ type: 'error', error: err?.message || 'Failed to draft captions.' });
        }
    }
}
exports.OndieService = OndieService;

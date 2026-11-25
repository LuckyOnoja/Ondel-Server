import axios from 'axios'
import { prisma } from '../../config/prisma.js'
import { env } from '../../config/env.js'
import { SpotifyService } from '../../services/spotify.service.js'

export type PlanKind = 'post' | 'video' | 'conversation' | 'ads' | 'pitch'
export type PlatformId = 'instagram' | 'tiktok' | 'youtube' | 'threads' | 'x' | 'spotify'

export interface OndiePlanItem {
  date: string
  title: string
  kind: PlanKind
  platforms: PlatformId[]
  why: string
  caption?: string
}

export interface OndiePlan {
  summary: string
  items: OndiePlanItem[]
}

export interface OndiePlaylist {
  id: string
  name: string
  owner: string
  url: string
  image: string | null
  description: string
  tracks: number
  followers: number | null
  lastAddedAt: string | null
  mentionsSubmissions: boolean
  source: 'spotify'
}

export interface OndieStoryboard {
  title: string
  hook: string
  section: string
  length: number
  shots: { start: number; end: number; shot: string; text: string }[]
  caption: string
}

export type OndieStreamEvent =
  | { type: 'step'; id: string; label: string; status: 'active' | 'done' | 'error'; detail?: string }
  | { type: 'thinking'; delta: string }
  | { type: 'text'; delta: string }
  | { type: 'playlists'; playlists: OndiePlaylist[]; source: 'spotify' }
  | { type: 'plan'; plan: OndiePlan }
  | { type: 'storyboard'; storyboard: OndieStoryboard }
  | { type: 'chat'; chatId: string; userMessageId: string; assistantMessageId: string }
  | { type: 'done'; refused: boolean }
  | { type: 'error'; error: string }

const VALID_PLATFORMS = new Set<PlatformId>(['instagram', 'tiktok', 'youtube', 'threads', 'x', 'spotify'])
const VALID_KINDS = new Set<PlanKind>(['post', 'video', 'conversation', 'ads', 'pitch'])

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  return d.toISOString().split('T')[0]
}

function addDaysIso(iso: string, offset: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + offset, 12, 0, 0))
  return dt.toISOString().split('T')[0]
}

function daysBetweenIso(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T12:00:00Z`).getTime()
  const b = new Date(`${toIso}T12:00:00Z`).getTime()
  return Math.round((b - a) / 86_400_000)
}

function sanitizePlan(raw: any, todayIso: string, releaseIso: string | null): OndiePlan {
  const summary = typeof raw?.summary === 'string' && raw.summary.trim()
    ? raw.summary.trim()
    : 'A tailored release plan built from your project details and release date.'

  const rawItems = Array.isArray(raw?.items) ? raw.items : []
  const items: OndiePlanItem[] = []

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue
    const title = String(item.title || '').trim().slice(0, 80)
    if (!title) continue

    let date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.date)
      ? item.date.slice(0, 10)
      : releaseIso || addDaysIso(todayIso, 7)

    if (date < todayIso) date = todayIso

    const kind: PlanKind = VALID_KINDS.has(item.kind) ? item.kind : 'post'
    const rawPlatforms = Array.isArray(item.platforms) ? item.platforms : []
    const platforms: PlatformId[] = rawPlatforms
      .map((p: any) => String(p).toLowerCase().trim() as PlatformId)
      .filter((p: PlatformId): p is PlatformId => VALID_PLATFORMS.has(p))

    if (platforms.length === 0) {
      platforms.push(kind === 'pitch' ? 'spotify' : kind === 'video' ? 'tiktok' : 'instagram')
    }

    const why = typeof item.why === 'string' && item.why.trim()
      ? item.why.trim()
      : 'Scheduled to build momentum for your release.'

    items.push({
      date,
      title,
      kind,
      platforms: [...new Set(platforms)],
      why,
      ...(typeof item.caption === 'string' && item.caption.trim() ? { caption: item.caption.trim() } : {}),
    })
  }

  items.sort((a, b) => a.date.localeCompare(b.date))
  return { summary, items }
}

function sanitizeStoryboard(raw: any, fallbackTitle: string): OndieStoryboard {
  const shots = Array.isArray(raw?.shots)
    ? raw.shots
        .filter((s: any) => s && typeof s === 'object')
        .map((s: any, i: number) => ({
          start: Number.isFinite(Number(s.start)) ? Number(s.start) : i * 3,
          end: Number.isFinite(Number(s.end)) ? Number(s.end) : (i + 1) * 3,
          shot: String(s.shot || '').trim() || 'Performance close-up.',
          text: String(s.text || '').trim(),
        }))
    : []

  return {
    title: String(raw?.title || fallbackTitle).trim().slice(0, 60),
    hook: String(raw?.hook || 'Visual hook synced to your chorus.').trim(),
    section: String(raw?.section || 'Chorus').trim(),
    length: [7, 15, 30].includes(Number(raw?.length)) ? Number(raw.length) : 15,
    shots: shots.length ? shots : [{ start: 0, end: 15, shot: 'Film yourself performing the hook in natural lighting.', text: fallbackTitle }],
    caption: String(raw?.caption || `${fallbackTitle} — out soon.`).trim(),
  }
}

async function searchSpotifyPlaylists(query: string, limit = 6): Promise<OndiePlaylist[]> {
  const token = await SpotifyService.getAccessToken()
  if (!token) return []

  try {
    const res = await axios.get('https://api.spotify.com/v1/search', {
      params: { q: query, type: 'playlist', limit: Math.min(Math.max(limit, 1), 10) },
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    })

    const rawList = (res.data?.playlists?.items || []).filter(Boolean)
    const playlists: OndiePlaylist[] = []

    for (const pl of rawList.slice(0, limit)) {
      const description = String(pl.description || '').replace(/<[^>]+>/g, '').trim()
      const mentionsSubmissions = /submit|submission|dm|email|@|submithub|groover|pitch|contact/i.test(description)
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
      })
    }

    return playlists
  } catch (err: any) {
    console.warn('[OndieService] Spotify playlist search failed:', err.message)
    return []
  }
}

const DEEPSEEK_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'propose_release_plan',
      description:
        'Propose a concrete, dated release plan for this music project (single, EP, or album). The UI displays it as an interactive editable draft that the artist can tweak and save straight to their calendar.',
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
      description:
        'Search live Spotify playlists matching a genre, mood, or artist scene so the artist can find real playlists to pitch.',
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
      description:
        'Propose a 9:16 short-form video storyboard (TikTok / Reels / Shorts) tailored to the artist project.',
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
]

interface ToolCallAccum {
  id: string
  name: string
  arguments: string
}

async function streamDeepSeekTurn(
  apiKey: string,
  messages: any[],
  useTools: boolean,
  onTextDelta: (delta: string) => void,
  signal?: AbortSignal
): Promise<{ content: string; toolCalls: ToolCallAccum[] }> {
  const payload: Record<string, any> = {
    model: 'deepseek-chat',
    messages,
    temperature: 0.7,
    stream: true,
  }
  if (useTools) {
    payload.tools = DEEPSEEK_TOOLS
    payload.tool_choice = 'auto'
  }

  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok || !response.body) {
    const errBody = await response.text().catch(() => '')
    console.error(`[OndieService] Upstream model error ${response.status}:`, errBody.slice(0, 300))
    throw new Error('Ondie couldn’t complete this right now. Please try again.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let content = ''
  const toolMap = new Map<number, ToolCallAccum>()

  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line || !line.startsWith('data:')) continue
      const dataStr = line.slice(5).trim()
      if (dataStr === '[DONE]') continue

      let parsed: any
      try {
        parsed = JSON.parse(dataStr)
      } catch {
        continue
      }

      const delta = parsed?.choices?.[0]?.delta
      if (!delta) continue

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content
        onTextDelta(delta.content)
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const tcIndex = typeof tc.index === 'number' ? tc.index : 0
          const existing = toolMap.get(tcIndex) || { id: '', name: '', arguments: '' }
          if (tc.id) existing.id = tc.id
          if (tc.function?.name) existing.name += tc.function.name
          if (tc.function?.arguments) existing.arguments += tc.function.arguments
          toolMap.set(tcIndex, existing)
        }
      }
    }
  }

  const toolCalls = [...toolMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, v]) => v)
    .filter((tc) => tc.name)

  return { content, toolCalls }
}

export class OndieService {
  static async loadProjectContext(projectId: string) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: { include: { artists: true } },
        songs: { include: { artist: true }, orderBy: { createdAt: 'asc' } },
        vaultItems: { orderBy: { uploadedAt: 'desc' } },
        calendarEvents: { orderBy: { date: 'asc' } },
      },
    })

    if (!project) throw new Error('Project not found')

    const todayIso = toIsoDate(new Date())
    const releaseIso = project.releaseTargetDate ? toIsoDate(project.releaseTargetDate) : null
    const daysToRelease = releaseIso ? daysBetweenIso(todayIso, releaseIso) : null
    const meta = (project.metadata && typeof project.metadata === 'object' ? project.metadata : {}) as Record<string, any>
    const roles: Record<string, string> = meta.roles && typeof meta.roles === 'object' ? meta.roles : {}
    const lyrics = typeof meta.lyrics === 'string' && meta.lyrics.trim() ? meta.lyrics.trim() : null

    const artistName =
      project.songs[0]?.artist?.name ||
      project.user?.artists?.[0]?.name ||
      project.user?.name ||
      'Artist'

    const vaultSummary = project.vaultItems.map((v) => {
      const role = roles[v.fileUrl || v.id] || v.type
      return `- ${v.name} (type: ${v.type}, role: ${role}, size: ${v.size})`
    })

    const songsSummary = project.songs.map((s) => {
      const parts = [`"${s.title}"`]
      if (s.genre) parts.push(`genre: ${s.genre}`)
      if (s.bpm) parts.push(`${s.bpm} BPM`)
      if (s.soundVibe) parts.push(`vibe: ${s.soundVibe}`)
      if (s.similarArtists?.length) parts.push(`sounds like: ${s.similarArtists.join(', ')}`)
      const audioName = (s.metadata as any)?.audioFileName
      if (audioName) parts.push(`audio file: ${audioName}`)
      return `- ${parts.join(' | ')}`
    })

    const calendarSummary = project.calendarEvents.map((e) => {
      const d = toIsoDate(e.date)
      const plats = e.platforms?.length ? ` [${e.platforms.join(', ')}]` : ''
      const status = e.postedAt || e.completed ? ' (done)' : ''
      return `- ${d}: ${e.title}${plats}${status}`
    })

    const hasMaster = project.vaultItems.some((v) => v.type === 'master' || roles[v.fileUrl || v.id] === 'master') || project.songs.some((s) => Boolean(s.audioUrl))
    const hasCover = project.vaultItems.some((v) => v.type === 'artwork' || roles[v.fileUrl || v.id] === 'cover')
    const hasSplits = project.vaultItems.some((v) => roles[v.fileUrl || v.id] === 'splits' || /split/i.test(v.name)) || (Array.isArray(meta.skipped) && meta.skipped.includes('splits'))

    const systemPrompt = `You are Ondie, the intelligent release manager inside Ondel — an operating system for independent music artists preparing a Single, EP, or Album release.

LIVE PROJECT CONTEXT (from the artist's database):
- Today's date: ${todayIso}
- Project name: "${project.name}" (${project.releaseType || 'SINGLE'})
- Artist: ${artistName}
- Release date: ${releaseIso ? `${releaseIso} (${daysToRelease === 0 ? 'today!' : daysToRelease! > 0 ? `${daysToRelease} days from today` : `${Math.abs(daysToRelease!)} days ago`})` : 'Not set yet'}
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
6. Never promise guaranteed streams, virality, or editorial placement — frame submissions honestly as pitches curators review.`

    return {
      project,
      todayIso,
      releaseIso,
      daysToRelease,
      artistName,
      systemPrompt,
      contextDetail: `${project.name} · ${releaseIso ? `out ${releaseIso}` : 'date not set'} · ${project.vaultItems.length} vault ${project.vaultItems.length === 1 ? 'file' : 'files'} · ${project.calendarEvents.length} on calendar`,
    }
  }

  static async getProjectChats(projectId: string) {
    const chats = await prisma.projectChat.findMany({
      where: { projectId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
      orderBy: { updatedAt: 'desc' },
    })

    return chats.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      messages: c.messages.map((m) => {
        const payload = (m.payload && typeof m.payload === 'object' ? m.payload : {}) as Record<string, any>
        if (m.role === 'user') {
          return {
            id: m.id,
            role: 'user' as const,
            text: m.text,
            attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
            sentAt: m.createdAt.toISOString(),
          }
        }
        return {
          id: m.id,
          role: 'ondie' as const,
          text: m.text,
          blocks: Array.isArray(payload.blocks) ? payload.blocks : m.text ? [{ kind: 'text', text: m.text }] : [],
          shown: typeof payload.shown === 'number' ? payload.shown : m.text.length,
          status: 'done' as const,
          sentAt: m.createdAt.toISOString(),
          feedback: payload.feedback ?? null,
          taken: Array.isArray(payload.taken) ? payload.taken : [],
          playlists: Array.isArray(payload.playlists) ? payload.playlists : undefined,
          playlistSource: payload.playlistSource ?? undefined,
          plan: payload.plan ?? undefined,
          planAdded: Boolean(payload.planAdded),
          steps: Array.isArray(payload.steps) ? payload.steps : undefined,
          storyboard: payload.storyboard ?? undefined,
        }
      }),
    }))
  }

  static async updateChatMessagePayload(
    projectId: string,
    messageId: string,
    patch: Record<string, any>
  ) {
    const msg = await prisma.projectChatMessage.findUnique({
      where: { id: messageId },
      include: { chat: true },
    })

    if (!msg || msg.chat.projectId !== projectId) {
      throw new Error('Chat message not found in project')
    }

    const existing = msg.payload && typeof msg.payload === 'object' ? (msg.payload as Record<string, any>) : {}
    const updated = await prisma.projectChatMessage.update({
      where: { id: messageId },
      data: {
        payload: {
          ...existing,
          ...patch,
        },
      },
    })

    return updated
  }

  static async deleteProjectChat(projectId: string, chatId: string) {
    const chat = await prisma.projectChat.findFirst({
      where: { id: chatId, projectId },
    })
    if (!chat) {
      throw new Error('Chat not found in project')
    }
    await prisma.projectChat.delete({
      where: { id: chatId },
    })
    return true
  }

  static async streamChat(
    projectId: string,
    input: {
      chatId?: string | null
      message: string
      attachments?: any[]
      turns?: { role: 'user' | 'assistant'; content: string }[]
    },
    emit: (event: OndieStreamEvent) => void,
    signal?: AbortSignal
  ) {
    const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('[OndieService] Missing AI API key in server/.env')
      emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' })
      return
    }

    const ctx = await this.loadProjectContext(projectId)
    emit({
      type: 'step',
      id: 'context',
      label: 'Read your project, Vault & calendar',
      status: 'done',
      detail: ctx.contextDetail,
    })

    // Ensure or create chat row in PostgreSQL
    let chat = input.chatId
      ? await prisma.projectChat.findFirst({
          where: { id: input.chatId, projectId },
          include: { messages: { orderBy: { createdAt: 'asc' } } },
        })
      : null

    const cleanText = (input.message || '').trim()
    const titleSeed = cleanText.replace(/\s+/g, ' ').slice(0, 78) || `Chat about ${ctx.project.name}`

    if (!chat) {
      chat = await prisma.projectChat.create({
        data: {
          projectId,
          title: titleSeed,
        },
        include: { messages: true },
      })
    }

    // Save user message to PostgreSQL
    const userMsg = await prisma.projectChatMessage.create({
      data: {
        chatId: chat.id,
        role: 'user',
        text: cleanText,
        payload: {
          attachments: Array.isArray(input.attachments) ? input.attachments : [],
        },
      },
    })

    // Build message history for DeepSeek from DB (or supplied turns if fresh)
    const historyTurns: { role: 'user' | 'assistant'; content: string }[] = []
    if (chat.messages.length > 0) {
      for (const m of chat.messages) {
        const p = (m.payload && typeof m.payload === 'object' ? m.payload : {}) as Record<string, any>
        if (m.role === 'user') {
          if (m.text.trim()) historyTurns.push({ role: 'user', content: m.text })
        } else {
          let assistantText = m.text || ''
          if (p.plan?.items?.length) {
            assistantText += `\n\n[Proposed release plan (${p.plan.items.length} items${p.planAdded ? ', already added to calendar' : ', editable draft'}): ${p.plan.items.map((it: any) => `${it.date} ${it.title}`).join('; ')}]`
          }
          if (assistantText.trim()) historyTurns.push({ role: 'assistant', content: assistantText.trim() })
        }
      }
      historyTurns.push({ role: 'user', content: cleanText })
    } else if (Array.isArray(input.turns) && input.turns.length > 0) {
      for (const t of input.turns) {
        if (t?.content?.trim()) {
          historyTurns.push({ role: t.role === 'assistant' ? 'assistant' : 'user', content: t.content })
        }
      }
    } else {
      historyTurns.push({ role: 'user', content: cleanText })
    }

    const attachmentNote =
      Array.isArray(input.attachments) && input.attachments.length > 0
        ? `\n[Artist attached files in this message: ${input.attachments.map((a: any) => a.name || 'file').join(', ')}]`
        : ''
    if (attachmentNote && historyTurns.length > 0) {
      historyTurns[historyTurns.length - 1] = {
        ...historyTurns[historyTurns.length - 1],
        content: historyTurns[historyTurns.length - 1].content + attachmentNote,
      }
    }

    const deepseekMessages: any[] = [
      { role: 'system', content: ctx.systemPrompt },
      ...historyTurns.slice(-18),
    ]

    const recordedSteps: { id: string; label: string; status: 'active' | 'done' | 'error'; detail?: string }[] = [
      { id: 'context', label: 'Read your project, Vault & calendar', status: 'done', detail: ctx.contextDetail },
    ]
    let fullText = ''
    let producedPlan: OndiePlan | undefined
    let producedPlaylists: OndiePlaylist[] | undefined
    let producedStoryboard: OndieStoryboard | undefined

    emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'active' })

    try {
      for (let round = 0; round < 3; round++) {
        if (signal?.aborted) return

        const { content, toolCalls } = await streamDeepSeekTurn(
          apiKey,
          deepseekMessages,
          round < 2,
          (delta) => {
            fullText += delta
            emit({ type: 'text', delta })
          },
          signal
        )

        if (toolCalls.length === 0) break

        deepseekMessages.push({
          role: 'assistant',
          content: content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id || `call_${round}_${tc.name}`,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments },
          })),
        })

        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i]
          const callId = tc.id || `call_${round}_${tc.name}`
          const stepId = `tool-${round}-${i}`
          let args: any = {}
          try {
            args = JSON.parse(tc.arguments || '{}')
          } catch {
            args = {}
          }

          if (tc.name === 'propose_release_plan') {
            emit({ type: 'step', id: stepId, label: 'Drafting your release plan', status: 'active' })
            const plan = sanitizePlan(args, ctx.todayIso, ctx.releaseIso)
            producedPlan = plan
            emit({ type: 'plan', plan })
            const detail = `${plan.items.length} dated items`
            emit({ type: 'step', id: stepId, label: 'Drafting your release plan', status: 'done', detail })
            recordedSteps.push({ id: stepId, label: 'Drafting your release plan', status: 'done', detail })

            deepseekMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({
                ok: true,
                itemCount: plan.items.length,
                note: 'Plan is now displayed to the artist as an editable interactive draft with automatic checks. Summarize it briefly in 2-3 sentences and invite them to edit any item or click Add to calendar.',
              }),
            })
          } else if (tc.name === 'search_playlists') {
            const q = String(args.query || ctx.project.songs[0]?.genre || 'indie pop').trim()
            const label = `Searching Spotify for “${q}”`
            emit({ type: 'step', id: stepId, label, status: 'active' })
            const playlists = await searchSpotifyPlaylists(q, Number(args.limit) || 6)
            if (playlists.length > 0) {
              producedPlaylists = [...(producedPlaylists || []), ...playlists]
              emit({ type: 'playlists', playlists, source: 'spotify' })
            }
            const detail = playlists.length ? `${playlists.length} Spotify playlists` : 'No matching playlists found'
            emit({ type: 'step', id: stepId, label, status: 'done', detail })
            recordedSteps.push({ id: stepId, label, status: 'done', detail })

            deepseekMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({ playlists }),
            })
          } else if (tc.name === 'propose_storyboard') {
            emit({ type: 'step', id: stepId, label: 'Drafting video storyboard', status: 'active' })
            const sb = sanitizeStoryboard(args, ctx.project.name)
            producedStoryboard = sb
            emit({ type: 'storyboard', storyboard: sb })
            const detail = `${sb.shots.length} shots · ${sb.length}s`
            emit({ type: 'step', id: stepId, label: 'Drafting video storyboard', status: 'done', detail })
            recordedSteps.push({ id: stepId, label: 'Drafting video storyboard', status: 'done', detail })

            deepseekMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({ ok: true, note: 'Storyboard shown to the artist. Briefly describe the concept in 1-2 sentences.' }),
            })
          } else {
            deepseekMessages.push({
              role: 'tool',
              tool_call_id: callId,
              content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
            })
          }
        }
      }

      if (!fullText.trim() && producedPlan) {
        const fallbackNote = `I put together a ${producedPlan.items.length}-item release plan for ${ctx.project.name}. You can edit any date, title, or platform below — or reply with changes — then click Add to calendar when you're ready.`
        fullText = fallbackNote
        emit({ type: 'text', delta: fallbackNote })
      }

      emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'done' })
      recordedSteps.push({ id: 'think', label: 'Thinking through your release', status: 'done' })

      // Persist assistant response in PostgreSQL
      const assistantMsg = await prisma.projectChatMessage.create({
        data: {
          chatId: chat.id,
          role: 'ondie',
          text: fullText.trim(),
          payload: {
            plan: producedPlan ? (producedPlan as any) : undefined,
            planAdded: false,
            playlists: producedPlaylists ? (producedPlaylists as any) : undefined,
            playlistSource: producedPlaylists?.length ? 'spotify' : undefined,
            storyboard: producedStoryboard ? (producedStoryboard as any) : undefined,
            steps: recordedSteps,
            feedback: null,
            taken: [],
          },
        },
      })

      await prisma.projectChat.update({
        where: { id: chat.id },
        data: { updatedAt: new Date() },
      })

      emit({
        type: 'chat',
        chatId: chat.id,
        userMessageId: userMsg.id,
        assistantMessageId: assistantMsg.id,
      })
      emit({ type: 'done', refused: false })
    } catch (err: any) {
      if (signal?.aborted) return
      console.error('[OndieService streamChat error]:', err)
      emit({ type: 'step', id: 'think', label: 'Thinking through your release', status: 'error' })
      emit({ type: 'error', error: 'Ondie ran into a problem. Please try again.' })
    }
  }

  static async streamCaptions(
    projectId: string,
    reqBody: {
      sections: { key: string; label: string; limit: number | null }[]
      post: { title: string; when: string; platforms: string[]; media: string; caption: string }
    },
    emit: (event: any) => void,
    signal?: AbortSignal
  ) {
    const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('[OndieService] Missing AI API key in server/.env')
      emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' })
      return
    }

    const ctx = await this.loadProjectContext(projectId)
    emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'active' })

    const sectionPrompt = reqBody.sections
      .map((s) => `=== ${s.key}\n(${s.label}${s.limit ? `, max ${s.limit} chars` : ''})`)
      .join('\n')

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
    ]

    try {
      await streamDeepSeekTurn(
        apiKey,
        messages,
        false,
        (delta) => emit({ type: 'text', delta }),
        signal
      )
      emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'done' })
      emit({ type: 'done', refused: false })
    } catch (err: any) {
      if (signal?.aborted) return
      console.error('[OndieService streamCaptions error]:', err)
      emit({ type: 'step', id: 'draft', label: 'Drafting captions with Ondie', status: 'error' })
      emit({ type: 'error', error: 'Ondie couldn’t draft captions right now. Please try again.' })
    }
  }

  static async streamEditorialPitch(
    projectId: string,
    reqBody: {
      length?: 'full' | 'short'
      existingDraft?: string
      pitchRecord?: { target: string; who?: string; status?: string }[]
    },
    emit: (event: any) => void,
    signal?: AbortSignal
  ) {
    const apiKey = env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY
    if (!apiKey) {
      console.error('[OndieService] Missing AI API key in server/.env')
      emit({ type: 'error', error: 'Ondie is temporarily unavailable right now. Please try again shortly.' })
      return
    }

    const project = await prisma.project.findUnique({
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
    })

    if (!project) {
      emit({ type: 'error', error: 'Project not found.' })
      return
    }

    // Pull any onboarding / waitlist submission matched by email for extra taste/story context
    const waitlistSubmission = project.user?.email
      ? await prisma.waitlistSubmission
          .findFirst({
            where: { email: project.user.email },
            orderBy: { createdAt: 'desc' },
          })
          .catch(() => null)
      : null

    emit({ type: 'step', id: 'pitch', label: 'Reading your song, artist style, and schedule', status: 'active' })

    const todayIso = toIsoDate(new Date())
    const releaseIso = project.releaseTargetDate ? toIsoDate(project.releaseTargetDate) : null
    const daysToRelease = releaseIso ? daysBetweenIso(todayIso, releaseIso) : null
    const meta = (project.metadata && typeof project.metadata === 'object' ? project.metadata : {}) as Record<string, any>
    const roles: Record<string, string> = meta.roles && typeof meta.roles === 'object' ? meta.roles : {}
    const lyrics = typeof meta.lyrics === 'string' && meta.lyrics.trim() ? meta.lyrics.trim() : null

    const primaryArtist = project.songs[0]?.artist || project.user?.artists?.[0] || null
    const artistName = primaryArtist?.name || project.user?.name || 'the artist'
    const artistCountry = primaryArtist?.country || null
    const artistBio = primaryArtist?.bio || null
    const artistGenres = new Set<string>(primaryArtist?.genres || [])

    // Collect musical DNA across all of the artist's songs & past projects
    const similarArtists = new Set<string>()
    const vibes: string[] = []
    const subgenres = new Set<string>()
    const catalogTitles: string[] = []

    const allSongs = [
      ...project.songs,
      ...(project.user?.artists?.flatMap((a) => a.songs) || []),
      ...(project.user?.projects?.flatMap((p) => p.songs) || []),
    ]
    const seenSongIds = new Set<string>()
    for (const s of allSongs) {
      if (seenSongIds.has(s.id)) continue
      seenSongIds.add(s.id)
      if (s.genre) artistGenres.add(s.genre)
      for (const sg of s.subgenres || []) if (sg) subgenres.add(sg)
      for (const sa of s.similarArtists || []) if (sa) similarArtists.add(sa)
      if (s.soundVibe) vibes.push(s.soundVibe)
      if (s.projectId !== project.id && s.title) catalogTitles.push(`${s.title}${s.genre ? ` (${s.genre})` : ''}`)
    }

    for (const c of project.user?.campaigns || []) {
      for (const g of c.targetGenres || []) if (g) artistGenres.add(g)
      for (const sa of c.similarArtists || []) if (sa) similarArtists.add(sa)
      if (c.soundVibe) vibes.push(c.soundVibe)
    }

    const songsInProject = project.songs.map((s) => {
      const parts = [`"${s.title}"`]
      if (s.genre) parts.push(`genre: ${s.genre}`)
      if (s.subgenres?.length) parts.push(`subgenres: ${s.subgenres.join(', ')}`)
      if (s.bpm) parts.push(`${s.bpm} BPM`)
      if (s.soundVibe) parts.push(`vibe/mood: ${s.soundVibe}`)
      if (s.similarArtists?.length) parts.push(`sounds like / fans of: ${s.similarArtists.join(', ')}`)
      const audioName = (s.metadata as any)?.audioFileName
      if (audioName) parts.push(`master file: ${audioName}`)
      return `- ${parts.join(' | ')}`
    })

    const vaultLines = project.vaultItems.map((v) => {
      const role = roles[v.fileUrl || v.id] || v.type
      return `- ${v.name} (${role})`
    })

    const scheduleLines = project.calendarEvents.slice(0, 14).map((e) => {
      const d = toIsoDate(e.date)
      const plats = e.platforms?.length ? ` [${e.platforms.join(', ')}]` : ''
      return `- ${d}: ${e.title}${plats}${e.why ? ` — ${e.why}` : ''}`
    })

    const recentArtistNotes = project.chats
      .flatMap((c) => c.messages.map((m) => m.text.trim()))
      .filter((t) => t.length > 10 && !/^plan my release/i.test(t))
      .slice(0, 5)

    const draftData =
      project.user?.waitlistDraft?.data && typeof project.user.waitlistDraft.data === 'object'
        ? (project.user.waitlistDraft.data as Record<string, any>)
        : null

    const targetLength = reqBody.length === 'short' ? 'short' : 'full'
    const charGoal =
      targetLength === 'short'
        ? '190 to 270 characters (punchy, ultra-tight, NEVER exceed 290 characters)'
        : '340 to 465 characters (rich, vivid, STRICTLY under 485 characters — Spotify hard-caps editorial pitches at 500 characters)'

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
      .join('\n')

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
    ]

    try {
      let emitted = 0
      await streamDeepSeekTurn(
        apiKey,
        messages,
        false,
        (delta) => {
          // Strip accidental leading/trailing quotes if the model wraps output
          let clean = delta
          if (emitted === 0) clean = clean.replace(/^["“']/, '')
          emitted += clean.length
          if (clean) emit({ type: 'text', delta: clean })
        },
        signal
      )
      emit({ type: 'step', id: 'pitch', label: 'Pitch draft ready', status: 'done' })
      emit({ type: 'done', refused: false })
    } catch (err: any) {
      if (signal?.aborted) return
      console.error('[OndieService streamEditorialPitch error]:', err)
      emit({ type: 'step', id: 'pitch', label: 'Drafting pitch with Ondie', status: 'error' })
      emit({ type: 'error', error: 'Ondie couldn’t draft your pitch right now. Please try again.' })
    }
  }
}

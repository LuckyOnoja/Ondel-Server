import fs from 'fs'
import path from 'path'
import { prisma } from '../../config/prisma.js'
import { generateSongSlug } from '../../utils/slugify.js'
import { AudioScrutinizerService } from '../songs/audio-scrutinizer.service.js'
import {
  ProjectDto,
  ProjectSongDto,
  ProjectVaultItemDto,
  ProjectCalendarEventDto,
} from './project.types.js'
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js'
import { CloudinaryService } from '../../services/cloudinary.service.js'

export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #3B82F6 100%)', // Neon Violet Glow
  'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)', // Electric Cyan Mint
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)', // Solar Ember Fire
  'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #F97316 100%)', // Sunset Coral Flare
  'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%)', // Galactic Indigo
  'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',
  'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',
  'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',
  'linear-gradient(135deg, #FF0844 0%, #FFB199 100%)',
  'linear-gradient(135deg, #F83600 0%, #FE8C00 100%)',
  'linear-gradient(135deg, #B224EF 0%, #7579FF 100%)',
  'linear-gradient(135deg, #9796F0 0%, #FBC7D4 100%)',
  'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)',
  'linear-gradient(135deg, #F77062 0%, #FE5196 100%)',
  'linear-gradient(135deg, #A8E063 0%, #56AB2F 100%)',
  'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)',
  'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',
  'linear-gradient(135deg, #5EE7DF 0%, #B490CA 100%)',
  'linear-gradient(135deg, #C33764 0%, #1D2671 100%)',
  'linear-gradient(135deg, #F12711 0%, #F5AF19 100%)',
]

function toIsoDate(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
  return d.toISOString().split('T')[0]
}

function parseIsoDay(iso: string): Date {
  const clean = iso.trim().slice(0, 10)
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return new Date(`${clean}T12:00:00.000Z`)
  }
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function kindToCategory(kind?: string, isRelease?: boolean): 'Release' | 'Content' | 'Pitch' | 'Promo' {
  if (isRelease || kind === 'release') return 'Release'
  if (kind === 'pitch') return 'Pitch'
  if (kind === 'ads' || kind === 'conversation') return 'Promo'
  return 'Content'
}

const PROJECT_INCLUDE = {
  songs: {
    include: { campaigns: true, artist: true },
  },
  vaultItems: true,
  calendarEvents: {
    orderBy: { date: 'asc' as const },
  },
  campaigns: true,
}

export class ProjectService {
  private mapCalendarEvent(ce: any): ProjectCalendarEventDto {
    return {
      id: ce.id,
      title: ce.title,
      date: ce.date ? toIsoDate(ce.date) : toIsoDate(new Date()),
      category: (ce.category || 'Content') as ProjectCalendarEventDto['category'],
      kind: ce.kind || undefined,
      platforms: Array.isArray(ce.platforms) ? ce.platforms : [],
      caption: ce.caption || undefined,
      captions: ce.captions && typeof ce.captions === 'object' ? ce.captions : undefined,
      why: ce.why || undefined,
      time: ce.time || undefined,
      timeZone: ce.timeZone || undefined,
      remind: Boolean(ce.remind),
      isRelease: Boolean(ce.isRelease),
      fromOndie: Boolean(ce.fromOndie),
      postedAt: ce.postedAt ? new Date(ce.postedAt).toISOString() : undefined,
      attachments: Array.isArray(ce.attachments) ? ce.attachments : undefined,
      songTitle: ce.songTitle || undefined,
      songId: ce.songId || undefined,
      completed: Boolean(ce.completed),
    }
  }

  private mapToProjectDto(p: any): ProjectDto {
    return {
      id: p.id,
      name: p.name,
      releaseType: (p.releaseType || 'SINGLE') as ProjectDto['releaseType'],
      gradient: p.gradient || GRADIENT_PRESETS[0],
      createdAt: p.createdAt ? toIsoDate(p.createdAt) : toIsoDate(new Date()),
      releaseTargetDate: p.releaseTargetDate ? toIsoDate(p.releaseTargetDate) : undefined,
      metadata: p.metadata && typeof p.metadata === 'object' ? p.metadata : {},
      songs: (p.songs || []).map((s: any, idx: number) => ({
        id: s.id,
        slug: s.slug || undefined,
        title: s.title,
        artistName: s.artist?.name || 'Artist',
        audioUrl: s.audioUrl || undefined,
        audioFileName: s.audioFileName || (s.metadata ? (s.metadata as any).audioFileName : undefined),
        status: 'Strategy Ready',
        releaseDate: s.createdAt ? toIsoDate(s.createdAt) : undefined,
        campaignsCount: s.campaigns ? s.campaigns.length : 0,
        gradient: s.gradient || GRADIENT_PRESETS[idx % GRADIENT_PRESETS.length],
        bpm: s.bpm || (s.metadata ? (s.metadata as any).estimatedBpm : undefined) || undefined,
        genre: s.genre || undefined,
        subgenres: s.subgenres || [],
        similarArtists: s.similarArtists || [],
        calendarPlanGenerated: s.calendarPlanGenerated || false,
      })),
      vaultItems: (() => {
        const seen = new Set<string>()
        const list: ProjectVaultItemDto[] = []
        for (const v of p.vaultItems || []) {
          const key = `${v.name}-${v.fileUrl || v.id}`
          if (seen.has(key)) continue
          seen.add(key)
          list.push({
            id: v.id,
            slug: v.slug || undefined,
            name: v.name,
            type: v.type as any,
            size: v.size,
            uploadedAt: v.uploadedAt ? toIsoDate(v.uploadedAt) : toIsoDate(new Date()),
            fileUrl: v.fileUrl || undefined,
          })
        }
        return list
      })(),
      calendarEvents: (p.calendarEvents || []).map((ce: any) => this.mapCalendarEvent(ce)),
      campaigns: (p.campaigns || []).map((c: any) => ({
        id: c.id,
        title: c.goal || 'Campaign',
        platform: 'TikTok' as const,
        status: (c.status || 'Active') as any,
        reach: `${c.budgetCredits || 10} Credits`,
      })),
    }
  }

  async getUserProjects(userIdOrEmail: string): Promise<ProjectDto[]> {
    const identifier = userIdOrEmail.toLowerCase().trim()

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ id: identifier }, { email: identifier }],
      },
      include: { artists: true },
    })

    if (!user) {
      user = await prisma.user.findFirst({
        orderBy: { createdAt: 'desc' },
        include: { artists: true },
      })
    }

    if (!user) return []

    const projects = await prisma.project.findMany({
      where: { userId: user.id },
      include: PROJECT_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return projects.map((p) => this.mapToProjectDto(p))
  }

  private async getUniqueProjectGradient(userId: string): Promise<string> {
    const userProjects = await prisma.project.findMany({
      where: { userId },
      select: { gradient: true },
    })
    const usedGradients = new Set(userProjects.map((p) => p.gradient))
    const available = GRADIENT_PRESETS.find((g) => !usedGradients.has(g))
    if (available) return available
    return GRADIENT_PRESETS[userProjects.length % GRADIENT_PRESETS.length]
  }

  private async getUniqueSongGradient(projectId: string): Promise<string> {
    const projectSongs = await prisma.song.findMany({
      where: { projectId },
      select: { gradient: true },
    })
    const usedGradients = new Set(projectSongs.map((s) => s.gradient).filter(Boolean))
    const available = GRADIENT_PRESETS.find((g) => !usedGradients.has(g))
    if (available) return available
    return GRADIENT_PRESETS[projectSongs.length % GRADIENT_PRESETS.length]
  }

  private async syncReleaseDayEvent(projectId: string, projectName: string, releaseDateIso: string) {
    const releaseDate = parseIsoDay(releaseDateIso)
    const existing = await prisma.calendarEvent.findFirst({
      where: { projectId, isRelease: true },
    })
    if (existing) {
      await prisma.calendarEvent.update({
        where: { id: existing.id },
        data: {
          title: `${projectName} — Release Day`,
          date: releaseDate,
          category: 'Release',
          kind: 'release',
          platforms: existing.platforms.length ? existing.platforms : ['all'],
          isRelease: true,
        },
      })
    } else {
      await prisma.calendarEvent.create({
        data: {
          projectId,
          title: `${projectName} — Release Day`,
          date: releaseDate,
          category: 'Release',
          kind: 'release',
          platforms: ['all'],
          isRelease: true,
        },
      })
    }
  }

  async createProject(
    userIdOrEmail: string,
    name: string,
    gradient?: string,
    initialSongTitle?: string,
    audioFileName?: string,
    audioUrl?: string,
    releaseType?: string,
    releaseTargetDate?: string
  ): Promise<ProjectDto> {
    const identifier = userIdOrEmail.toLowerCase().trim()

    let user = await prisma.user.findFirst({
      where: {
        OR: [{ id: identifier }, { email: identifier }],
      },
      include: { artists: true },
    })

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: identifier,
          name: name ? name.split(' ')[0] : 'Artist',
          isVerified: true,
        },
        include: { artists: true },
      })
    }

    let artist = user.artists[0]
    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          userId: user.id,
          name: user.name || 'Artist',
          genres: ['Afrobeats'],
        },
      })
    }

    const existingUserProjectsCount = await prisma.project.count({
      where: { userId: user.id },
    })

    const gradientSignature = gradient || (await this.getUniqueProjectGradient(user.id))
    const defaultName =
      existingUserProjectsCount === 0 ? 'Untitled Project' : `Untitled Project ${existingUserProjectsCount + 1}`
    const projectName = name && name.trim() ? name.trim() : defaultName
    const validReleaseType = ['SINGLE', 'EP', 'ALBUM'].includes((releaseType || '').toUpperCase())
      ? (releaseType || 'SINGLE').toUpperCase()
      : 'SINGLE'

    const newProject = await prisma.project.create({
      data: {
        userId: user.id,
        name: projectName,
        releaseType: validReleaseType,
        gradient: gradientSignature,
        status: 'ACTIVE',
        releaseTargetDate: releaseTargetDate ? parseIsoDay(releaseTargetDate) : null,
      },
      include: PROJECT_INCLUDE,
    })

    if (releaseTargetDate) {
      await this.syncReleaseDayEvent(newProject.id, projectName, releaseTargetDate)
    }

    if (initialSongTitle || audioFileName || audioUrl) {
      const songTitle =
        initialSongTitle ||
        (audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : projectName)

      const songGradient = await this.getUniqueSongGradient(newProject.id)

      let slug = generateSongSlug(songTitle)
      let existingSlug = await prisma.song.findUnique({ where: { slug } })
      while (existingSlug) {
        slug = generateSongSlug(songTitle)
        existingSlug = await prisma.song.findUnique({ where: { slug } })
      }

      await prisma.song.create({
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
      })

      if (audioFileName) {
        await prisma.vaultItem.create({
          data: {
            projectId: newProject.id,
            name: audioFileName,
            type: 'master',
            size: 'Audio File',
            fileUrl: audioUrl || null,
          },
        })
      }
    }

    const fullProject = await prisma.project.findUnique({
      where: { id: newProject.id },
      include: PROJECT_INCLUDE,
    })

    return this.mapToProjectDto(fullProject || newProject)
  }

  async updateProject(
    userIdOrEmail: string,
    projectId: string,
    updates: {
      name?: string
      releaseTargetDate?: string | null
      releaseType?: string
      metadata?: Record<string, any>
    }
  ): Promise<ProjectDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    const data: Record<string, any> = {}

    if (typeof updates.name === 'string' && updates.name.trim()) {
      data.name = updates.name.trim()
    }

    if (typeof updates.releaseType === 'string' && ['SINGLE', 'EP', 'ALBUM'].includes(updates.releaseType.toUpperCase())) {
      data.releaseType = updates.releaseType.toUpperCase()
    }

    if (updates.releaseTargetDate !== undefined) {
      data.releaseTargetDate = updates.releaseTargetDate ? parseIsoDay(updates.releaseTargetDate) : null
    }

    if (updates.metadata && typeof updates.metadata === 'object') {
      const existingMeta = project.metadata && typeof project.metadata === 'object' ? (project.metadata as Record<string, any>) : {}
      data.metadata = {
        ...existingMeta,
        ...updates.metadata,
      }
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data,
      include: PROJECT_INCLUDE,
    })

    if (updates.releaseTargetDate) {
      await this.syncReleaseDayEvent(projectId, updatedProject.name, updates.releaseTargetDate)
    }

    const refreshed = await prisma.project.findUnique({
      where: { id: projectId },
      include: PROJECT_INCLUDE,
    })

    return this.mapToProjectDto(refreshed || updatedProject)
  }

  async addSongToProject(
    userIdOrEmail: string,
    projectId: string,
    songData: Omit<ProjectSongDto, 'id'>
  ): Promise<ProjectSongDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { user: { include: { artists: true } } },
    })

    if (!project) throw new Error('Project not found in database')

    let artist = project.user.artists[0]
    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          userId: project.userId,
          name: songData.artistName || 'Artist',
          genres: [songData.genre || 'Afrobeats'],
        },
      })
    }

    const songGradient = await this.getUniqueSongGradient(project.id)

    let slug = generateSongSlug(songData.title)
    let existingSlug = await prisma.song.findUnique({ where: { slug } })
    while (existingSlug) {
      slug = generateSongSlug(songData.title)
      existingSlug = await prisma.song.findUnique({ where: { slug } })
    }

    const createdSong = await prisma.song.create({
      data: {
        artistId: artist.id,
        projectId: project.id,
        title: songData.title,
        slug,
        genre: songData.genre || 'Afrobeats',
        audioUrl: songData.audioUrl || null,
        gradient: songGradient,
        metadata: songData.audioFileName ? { audioFileName: songData.audioFileName } : undefined,
      },
    })

    if (createdSong.audioUrl) {
      AudioScrutinizerService.scrutinizeSong(createdSong.id).catch((err) => {
        console.warn('[ProjectService] Background scrutinization failed:', err.message)
      })
    }

    return {
      id: createdSong.id,
      slug: createdSong.slug || slug,
      title: createdSong.title,
      artistName: artist.name,
      audioUrl: createdSong.audioUrl || undefined,
      audioFileName: songData.audioFileName,
      status: 'Strategy Ready',
      releaseDate: toIsoDate(createdSong.createdAt),
      campaignsCount: 0,
      gradient: createdSong.gradient || songGradient,
    }
  }

  private async ensureSongForMasterVaultItem(
    projectId: string,
    fileName: string,
    fileUrl?: string
  ): Promise<ProjectSongDto | undefined> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { user: { include: { artists: true } }, songs: { include: { artist: true } } },
    })
    if (!project) return undefined

    const cleanTitle =
      fileName
        .replace(/\.[^/.]+$/, '')
        .replace(/_+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || project.name

    // Skip if a song with the same audioUrl or same title already exists in this project
    const duplicate = project.songs.find(
      (s) =>
        (fileUrl && s.audioUrl && s.audioUrl === fileUrl) ||
        s.title.trim().toLowerCase() === cleanTitle.toLowerCase()
    )
    if (duplicate) return undefined

    let artist = project.user.artists[0]
    if (!artist) {
      artist = await prisma.artist.create({
        data: {
          userId: project.userId,
          name: project.user.name || 'Artist',
          genres: ['Afrobeats'],
        },
      })
    }

    const songGradient = await this.getUniqueSongGradient(project.id)
    let slug = generateSongSlug(cleanTitle)
    let existingSlug = await prisma.song.findUnique({ where: { slug } })
    while (existingSlug) {
      slug = generateSongSlug(cleanTitle)
      existingSlug = await prisma.song.findUnique({ where: { slug } })
    }

    const createdSong = await prisma.song.create({
      data: {
        artistId: artist.id,
        projectId: project.id,
        title: cleanTitle,
        slug,
        genre: 'Afrobeats',
        audioUrl: fileUrl || null,
        gradient: songGradient,
        metadata: { audioFileName: fileName },
      },
    })

    if (createdSong.audioUrl) {
      AudioScrutinizerService.scrutinizeSong(createdSong.id).catch((err) => {
        console.warn('[ProjectService] Background scrutinization failed:', err.message)
      })
    }

    return {
      id: createdSong.id,
      slug: createdSong.slug || slug,
      title: createdSong.title,
      artistName: artist.name,
      audioUrl: createdSong.audioUrl || undefined,
      audioFileName: fileName,
      status: 'Strategy Ready',
      releaseDate: toIsoDate(createdSong.createdAt),
      campaignsCount: 0,
      gradient: createdSong.gradient || songGradient,
    }
  }

  async addVaultItemToProject(
    userIdOrEmail: string,
    projectId: string,
    itemData: Omit<ProjectVaultItemDto, 'id'>
  ): Promise<{ vaultItem: ProjectVaultItemDto; song?: ProjectSongDto }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    const itemSlug = generateSongSlug(itemData.name)

    const createdItem = await prisma.vaultItem.create({
      data: {
        projectId: project.id,
        name: itemData.name,
        type: itemData.type || 'stem',
        size: itemData.size || 'Unknown size',
        fileUrl: itemData.fileUrl || null,
        slug: itemSlug,
      },
    })

    let syncedSong: ProjectSongDto | undefined
    if (createdItem.type === 'master') {
      syncedSong = await this.ensureSongForMasterVaultItem(
        project.id,
        createdItem.name,
        createdItem.fileUrl || undefined
      )
    }

    return {
      vaultItem: {
        id: createdItem.id,
        slug: createdItem.slug || undefined,
        name: createdItem.name,
        type: createdItem.type as any,
        size: createdItem.size,
        uploadedAt: toIsoDate(createdItem.uploadedAt),
        fileUrl: createdItem.fileUrl || undefined,
      },
      song: syncedSong,
    }
  }

  async uploadVaultFileToProject(
    userIdOrEmail: string,
    projectId: string,
    fileBuffer?: Buffer,
    fileName?: string,
    type: string = 'master',
    size?: string
  ): Promise<{ vaultItem: ProjectVaultItemDto; song?: ProjectSongDto }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    let fileUrl: string | undefined = undefined

    if (fileBuffer && fileName) {
      const uploaded = await CloudinaryService.uploadMediaBuffer(fileBuffer, fileName, undefined, {
        folder: 'ondel_vault',
      })
      fileUrl = uploaded.url
    }

    const itemSlug = generateSongSlug(fileName || 'vault-asset')

    const createdItem = await prisma.vaultItem.create({
      data: {
        projectId: project.id,
        name: fileName || 'Uploaded File',
        type: type || 'master',
        size: size || 'Unknown size',
        fileUrl: fileUrl || null,
        slug: itemSlug,
      },
    })

    let syncedSong: ProjectSongDto | undefined
    if (createdItem.type === 'master') {
      syncedSong = await this.ensureSongForMasterVaultItem(
        project.id,
        createdItem.name,
        createdItem.fileUrl || undefined
      )
    }

    return {
      vaultItem: {
        id: createdItem.id,
        slug: createdItem.slug || undefined,
        name: createdItem.name,
        type: createdItem.type as any,
        size: createdItem.size,
        uploadedAt: toIsoDate(createdItem.uploadedAt),
        fileUrl: createdItem.fileUrl || undefined,
      },
      song: syncedSong,
    }
  }

  private extractCloudinaryPublicId(url: string): string | null {
    try {
      const uploadIndex = url.indexOf('/upload/')
      if (uploadIndex === -1) return null
      let p = url.substring(uploadIndex + 8)
      if (p.startsWith('v') && p.includes('/')) {
        const slashIndex = p.indexOf('/')
        p = p.substring(slashIndex + 1)
      }
      const lastDotIndex = p.lastIndexOf('.')
      return lastDotIndex !== -1 ? p.substring(0, lastDotIndex) : p
    } catch {
      return null
    }
  }

  async renameVaultItemInProject(
    projectId: string,
    vaultItemId: string,
    newName: string
  ): Promise<{ vaultItem: ProjectVaultItemDto; song?: ProjectSongDto }> {
    const clean = newName.trim()
    if (!clean) throw new Error('Name cannot be empty')

    const item = await prisma.vaultItem.findFirst({
      where: { id: vaultItemId, projectId },
    })
    if (!item) throw new Error('Vault item not found in project')

    const updated = await prisma.vaultItem.update({
      where: { id: item.id },
      data: { name: clean },
    })

    let updatedSongDto: ProjectSongDto | undefined
    if (item.type === 'master' && item.fileUrl) {
      const cleanSongTitle = clean.replace(/\.[^/.]+$/, '').trim() || clean
      const linked = await prisma.song.findFirst({
        where: { projectId, audioUrl: item.fileUrl },
        include: { artist: true },
      })
      if (linked) {
        const s = await prisma.song.update({
          where: { id: linked.id },
          data: { title: cleanSongTitle },
          include: { artist: true },
        })
        updatedSongDto = {
          id: s.id,
          slug: s.slug || undefined,
          title: s.title,
          artistName: s.artist?.name || 'Artist',
          audioUrl: s.audioUrl || undefined,
          audioFileName: clean,
          status: 'Strategy Ready',
          releaseDate: toIsoDate(s.createdAt),
          campaignsCount: 0,
          gradient: s.gradient || undefined,
          genre: s.genre,
          subgenres: s.subgenres || [],
          similarArtists: s.similarArtists || [],
          bpm: s.bpm || undefined,
        }
      }
    }

    return {
      vaultItem: {
        id: updated.id,
        slug: updated.slug || undefined,
        name: updated.name,
        type: updated.type as ProjectVaultItemDto['type'],
        size: updated.size,
        uploadedAt: toIsoDate(updated.uploadedAt),
        fileUrl: updated.fileUrl || undefined,
      },
      song: updatedSongDto,
    }
  }

  async renameSongInProject(
    projectId: string,
    songId: string,
    newTitle: string
  ): Promise<ProjectSongDto> {
    const clean = newTitle.trim()
    if (!clean) throw new Error('Song title cannot be empty')

    const existing = await prisma.song.findFirst({
      where: { id: songId, projectId },
      include: { artist: true },
    })
    if (!existing) throw new Error('Song not found in project')

    const updated = await prisma.song.update({
      where: { id: existing.id },
      data: { title: clean },
      include: { artist: true },
    })

    if (existing.audioUrl) {
      await prisma.vaultItem.updateMany({
        where: { projectId, fileUrl: existing.audioUrl },
        data: { name: clean },
      })
    }

    return {
      id: updated.id,
      slug: updated.slug || undefined,
      title: updated.title,
      artistName: updated.artist?.name || 'Artist',
      audioUrl: updated.audioUrl || undefined,
      audioFileName: (updated.metadata as any)?.audioFileName || updated.title,
      status: 'Strategy Ready',
      releaseDate: toIsoDate(updated.createdAt),
      campaignsCount: 0,
      gradient: updated.gradient || undefined,
      genre: updated.genre,
      subgenres: updated.subgenres || [],
      similarArtists: updated.similarArtists || [],
      bpm: updated.bpm || undefined,
    }
  }

  async deleteVaultItemFromProject(
    userIdOrEmail: string,
    projectId: string,
    vaultItemId: string
  ): Promise<boolean> {
    const vaultItem = await prisma.vaultItem.findUnique({
      where: { id: vaultItemId },
    })

    if (!vaultItem || vaultItem.projectId !== projectId) {
      throw new Error('Vault item not found in project')
    }

    if (vaultItem.fileUrl && vaultItem.fileUrl.includes('cloudinary.com')) {
      try {
        const publicId = this.extractCloudinaryPublicId(vaultItem.fileUrl)
        if (publicId && isCloudinaryConfigured()) {
          await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => null)
          await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => null)
          await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => null)
        }
      } catch (cdnErr) {
        console.warn('⚠️ [Cloudinary] Soft warning purging vault item resource:', cdnErr)
      }
    }

    await prisma.vaultItem.delete({
      where: { id: vaultItemId },
    })

    // Keep project songs in sync if this master vault item was linked to a song with the same audioUrl
    if (vaultItem.type === 'master' && vaultItem.fileUrl) {
      await prisma.song.deleteMany({
        where: { projectId, audioUrl: vaultItem.fileUrl },
      })
    }

    return true
  }

  async getCalendarEventsForProject(projectId: string): Promise<ProjectCalendarEventDto[]> {
    const events = await prisma.calendarEvent.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
    })
    return events.map((e) => this.mapCalendarEvent(e))
  }

  async addCalendarEventToProject(
    userIdOrEmail: string,
    projectId: string,
    eventData: Omit<ProjectCalendarEventDto, 'id'>
  ): Promise<ProjectCalendarEventDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    const createdEvent = await prisma.calendarEvent.create({
      data: {
        projectId: project.id,
        songId: eventData.songId || null,
        title: eventData.title.trim(),
        date: parseIsoDay(eventData.date),
        category: eventData.category || kindToCategory(eventData.kind, eventData.isRelease),
        kind: eventData.kind || null,
        platforms: Array.isArray(eventData.platforms) ? eventData.platforms : [],
        caption: eventData.caption || null,
        captions: eventData.captions ? (eventData.captions as any) : undefined,
        why: eventData.why || null,
        time: eventData.time || null,
        timeZone: eventData.timeZone || null,
        remind: Boolean(eventData.remind),
        isRelease: Boolean(eventData.isRelease),
        fromOndie: Boolean(eventData.fromOndie),
        postedAt: eventData.postedAt ? new Date(eventData.postedAt) : null,
        attachments: eventData.attachments ? (eventData.attachments as any) : undefined,
        songTitle: eventData.songTitle || null,
        completed: Boolean(eventData.completed),
      },
    })

    return this.mapCalendarEvent(createdEvent)
  }

  async batchAddCalendarEvents(
    userIdOrEmail: string,
    projectId: string,
    events: Omit<ProjectCalendarEventDto, 'id'>[]
  ): Promise<ProjectCalendarEventDto[]> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { calendarEvents: true },
    })

    if (!project) throw new Error('Project not found in database')

    const existingKeys = new Set(
      project.calendarEvents.map((e) => `${toIsoDate(e.date)}::${e.title.trim().toLowerCase()}`)
    )

    const created: ProjectCalendarEventDto[] = []
    for (const ev of events) {
      if (!ev.title?.trim() || !ev.date) continue
      const key = `${toIsoDate(ev.date)}::${ev.title.trim().toLowerCase()}`
      if (existingKeys.has(key)) continue
      existingKeys.add(key)
      const row = await prisma.calendarEvent.create({
        data: {
          projectId: project.id,
          songId: ev.songId || null,
          title: ev.title.trim(),
          date: parseIsoDay(ev.date),
          category: ev.category || kindToCategory(ev.kind, ev.isRelease),
          kind: ev.kind || 'post',
          platforms: Array.isArray(ev.platforms) ? ev.platforms : [],
          caption: ev.caption || null,
          captions: ev.captions ? (ev.captions as any) : undefined,
          why: ev.why || null,
          time: ev.time || null,
          timeZone: ev.timeZone || null,
          remind: Boolean(ev.remind),
          isRelease: Boolean(ev.isRelease),
          fromOndie: ev.fromOndie ?? true,
          postedAt: ev.postedAt ? new Date(ev.postedAt) : null,
          attachments: ev.attachments ? (ev.attachments as any) : undefined,
          songTitle: ev.songTitle || project.name,
          completed: Boolean(ev.completed),
        },
      })
      created.push(this.mapCalendarEvent(row))
    }

    return created
  }

  async updateCalendarEvent(
    userIdOrEmail: string,
    projectId: string,
    eventId: string,
    updates: Partial<Omit<ProjectCalendarEventDto, 'id'>>
  ): Promise<ProjectCalendarEventDto> {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    })

    if (!existing || existing.projectId !== projectId) {
      throw new Error('Calendar event not found in project')
    }

    const data: Record<string, any> = {}
    if (updates.title !== undefined) data.title = updates.title.trim()
    if (updates.date !== undefined) data.date = parseIsoDay(updates.date)
    if (updates.category !== undefined) data.category = updates.category
    if (updates.kind !== undefined) data.kind = updates.kind
    if (updates.platforms !== undefined) data.platforms = updates.platforms
    if (updates.caption !== undefined) data.caption = updates.caption || null
    if (updates.captions !== undefined) data.captions = updates.captions ?? null
    if (updates.why !== undefined) data.why = updates.why || null
    if (updates.time !== undefined) data.time = updates.time || null
    if (updates.timeZone !== undefined) data.timeZone = updates.timeZone || null
    if (updates.remind !== undefined) data.remind = Boolean(updates.remind)
    if (updates.isRelease !== undefined) data.isRelease = Boolean(updates.isRelease)
    if (updates.fromOndie !== undefined) data.fromOndie = Boolean(updates.fromOndie)
    if (updates.postedAt !== undefined) data.postedAt = updates.postedAt ? new Date(updates.postedAt) : null
    if (updates.attachments !== undefined) data.attachments = updates.attachments ?? null
    if (updates.completed !== undefined) data.completed = Boolean(updates.completed)

    const updated = await prisma.calendarEvent.update({
      where: { id: eventId },
      data,
    })

    return this.mapCalendarEvent(updated)
  }

  async deleteCalendarEvent(
    userIdOrEmail: string,
    projectId: string,
    eventId: string
  ): Promise<boolean> {
    const existing = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
    })

    if (!existing || existing.projectId !== projectId) {
      throw new Error('Calendar event not found in project')
    }

    await prisma.calendarEvent.delete({
      where: { id: eventId },
    })

    return true
  }
}

export const projectService = new ProjectService()

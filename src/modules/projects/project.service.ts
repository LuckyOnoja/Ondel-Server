import { prisma } from '../../config/prisma.js'
import { ProjectDto, ProjectSongDto, ProjectVaultItemDto, ProjectCalendarEventDto, ProjectCampaignItemDto } from './project.types.js'

export const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #3B82F6 100%)', // Neon Violet Glow
  'linear-gradient(135deg, #10B981 0%, #06B6D4 50%, #3B82F6 100%)', // Electric Cyan Mint
  'linear-gradient(135deg, #F59E0B 0%, #EF4444 50%, #8B5CF6 100%)', // Solar Ember Fire
  'linear-gradient(135deg, #EC4899 0%, #F43F5E 50%, #F97316 100%)', // Sunset Coral Flare
  'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #D946EF 100%)', // Galactic Indigo
  'linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%)',               // Ocean Sky Blue
  'linear-gradient(135deg, #FA709A 0%, #FEE140 100%)',               // Tropical Pink Gold
  'linear-gradient(135deg, #43E97B 0%, #38F9D7 100%)',               // Mint Spark
  'linear-gradient(135deg, #FF0844 0%, #FFB199 100%)',               // Crimson Rose
  'linear-gradient(135deg, #F83600 0%, #FE8C00 100%)',               // Tangerine Blaze
  'linear-gradient(135deg, #B224EF 0%, #7579FF 100%)',               // Deep Purple Velvet
  'linear-gradient(135deg, #9796F0 0%, #FBC7D4 100%)',               // Pastel Amethyst
  'linear-gradient(135deg, #00C6FF 0%, #0072FF 100%)',               // Sapphire Flash
  'linear-gradient(135deg, #F77062 0%, #FE5196 100%)',               // Electric Peach
  'linear-gradient(135deg, #A8E063 0%, #56AB2F 100%)',               // Lime Emerald
  'linear-gradient(135deg, #E0C3FC 0%, #8EC5FC 100%)',               // Lavender Dusk
  'linear-gradient(135deg, #F093FB 0%, #F5576C 100%)',               // Cosmic Fuchsia
  'linear-gradient(135deg, #5EE7DF 0%, #B490CA 100%)',               // Turquoise Dream
  'linear-gradient(135deg, #C33764 0%, #1D2671 100%)',               // Midnight Ruby
  'linear-gradient(135deg, #F12711 0%, #F5AF19 100%)',               // Flare Amber
]

export class ProjectService {
  /**
   * Helper to map Prisma Project model with relations into clean ProjectDto
   */
  private mapToProjectDto(p: any): ProjectDto {
    return {
      id: p.id,
      name: p.name,
      gradient: p.gradient || GRADIENT_PRESETS[0],
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      releaseTargetDate: p.releaseTargetDate ? new Date(p.releaseTargetDate).toISOString().split('T')[0] : undefined,
      songs: (p.songs || []).map((s: any, idx: number) => ({
        id: s.id,
        title: s.title,
        artistName: s.artist?.name || 'Artist',
        audioUrl: s.audioUrl || undefined,
        audioFileName: s.audioFileName || (s.metadata ? (s.metadata as any).audioFileName : undefined),
        status: 'Strategy Ready',
        releaseDate: s.createdAt ? new Date(s.createdAt).toISOString().split('T')[0] : undefined,
        campaignsCount: s.campaigns ? s.campaigns.length : 0,
        gradient: s.gradient || GRADIENT_PRESETS[idx % GRADIENT_PRESETS.length],
      })),
      vaultItems: (p.vaultItems || []).map((v: any) => ({
        id: v.id,
        name: v.name,
        type: v.type as any,
        size: v.size,
        uploadedAt: v.uploadedAt ? new Date(v.uploadedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        fileUrl: v.fileUrl || undefined,
      })),
      calendarEvents: (p.calendarEvents || []).map((ce: any) => ({
        id: ce.id,
        title: ce.title,
        date: ce.date ? new Date(ce.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        category: ce.category as any,
        songTitle: ce.songTitle || undefined,
      })),
      campaigns: (p.campaigns || []).map((c: any) => ({
        id: c.id,
        title: c.goal || 'Campaign',
        platform: 'TikTok / Spotify',
        status: c.status || 'Active',
        reach: `${c.budgetCredits || 10} Credits`,
      })),
    }
  }

  /**
   * Get all projects for a given user or user email from PostgreSQL DB
   */
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

    if (!user) {
      return []
    }

    let projects = await prisma.project.findMany({
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
    })

    // If user has no project in PostgreSQL, auto-create default project for them
    if (projects.length === 0) {
      const defaultProject = await prisma.project.create({
        data: {
          userId: user.id,
          name: 'Untitled Project 1',
          gradient: GRADIENT_PRESETS[0],
          status: 'ACTIVE',
        },
        include: {
          songs: { include: { campaigns: true, artist: true } },
          vaultItems: true,
          calendarEvents: true,
          campaigns: true,
        },
      })
      projects = [defaultProject]
    }

    return projects.map((p) => this.mapToProjectDto(p))
  }

  /**
   * Select a unique gradient for a new project for a user
   */
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

  /**
   * Select a unique gradient for a new song in a project
   */
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

  /**
   * Create a new project in PostgreSQL DB
   */
  async createProject(
    userIdOrEmail: string,
    name: string,
    gradient?: string,
    initialSongTitle?: string,
    audioFileName?: string,
    audioUrl?: string
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

    const gradientSignature =
      gradient || (await this.getUniqueProjectGradient(user.id))

    const projectName = name && name.trim() ? name.trim() : `Untitled Project ${existingUserProjectsCount + 1}`

    const newProject = await prisma.project.create({
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
    })

    // If initial song or audio asset provided, create song & vault item in PostgreSQL connected to project!
    if (initialSongTitle || audioFileName || audioUrl) {
      const songTitle =
        initialSongTitle ||
        (audioFileName ? audioFileName.replace(/\.[^/.]+$/, '') : 'Initial Project Track')

      const songGradient = await this.getUniqueSongGradient(newProject.id)

      await prisma.song.create({
        data: {
          artistId: artist.id,
          projectId: newProject.id,
          title: songTitle,
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
            type: 'stem',
            size: 'Master Audio File',
            fileUrl: audioUrl || null,
          },
        })
      }

      await prisma.calendarEvent.create({
        data: {
          projectId: newProject.id,
          title: `${songTitle} Pitching & Release`,
          date: new Date(Date.now() + 14 * 86400000),
          category: 'Release',
          songTitle,
        },
      })
    }

    // Refetch newly created project with all relations populated
    const fullProject = await prisma.project.findUnique({
      where: { id: newProject.id },
      include: {
        songs: { include: { campaigns: true, artist: true } },
        vaultItems: true,
        calendarEvents: true,
        campaigns: true,
      },
    })

    return this.mapToProjectDto(fullProject || newProject)
  }

  /**
   * Add a song folder to an existing project in PostgreSQL DB
   */
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
          genres: ['Afrobeats'],
        },
      })
    }

    const songGradient = await this.getUniqueSongGradient(project.id)

    const createdSong = await prisma.song.create({
      data: {
        artistId: artist.id,
        projectId: project.id,
        title: songData.title,
        genre: 'Afrobeats',
        audioUrl: songData.audioUrl || null,
        gradient: songGradient,
        metadata: songData.audioFileName ? { audioFileName: songData.audioFileName } : undefined,
      },
    })

    return {
      id: createdSong.id,
      title: createdSong.title,
      artistName: artist.name,
      audioUrl: createdSong.audioUrl || undefined,
      audioFileName: songData.audioFileName,
      status: 'Strategy Ready',
      releaseDate: createdSong.createdAt.toISOString().split('T')[0],
      campaignsCount: 0,
      gradient: createdSong.gradient || songGradient,
    }
  }

  /**
   * Add a vault item to an existing project in PostgreSQL DB
   */
  async addVaultItemToProject(
    userIdOrEmail: string,
    projectId: string,
    itemData: Omit<ProjectVaultItemDto, 'id'>
  ): Promise<ProjectVaultItemDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    const createdItem = await prisma.vaultItem.create({
      data: {
        projectId: project.id,
        name: itemData.name,
        type: itemData.type || 'stem',
        size: itemData.size || 'Unknown size',
        fileUrl: itemData.fileUrl || null,
      },
    })

    return {
      id: createdItem.id,
      name: createdItem.name,
      type: createdItem.type as any,
      size: createdItem.size,
      uploadedAt: createdItem.uploadedAt.toISOString().split('T')[0],
      fileUrl: createdItem.fileUrl || undefined,
    }
  }

  /**
   * Add a calendar event to an existing project in PostgreSQL DB
   */
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
        title: eventData.title,
        date: new Date(eventData.date),
        category: eventData.category || 'Release',
        songTitle: eventData.songTitle || null,
      },
    })

    return {
      id: createdEvent.id,
      title: createdEvent.title,
      date: createdEvent.date.toISOString().split('T')[0],
      category: createdEvent.category as any,
      songTitle: createdEvent.songTitle || undefined,
    }
  }

  /**
   * Rename an existing project in PostgreSQL DB
   */
  async renameProject(
    userIdOrEmail: string,
    projectId: string,
    newName: string
  ): Promise<ProjectDto> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    })

    if (!project) throw new Error('Project not found in database')

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { name: newName.trim() || 'Untitled Project' },
      include: {
        songs: { include: { campaigns: true, artist: true } },
        vaultItems: true,
        calendarEvents: true,
        campaigns: true,
      },
    })

    return this.mapToProjectDto(updatedProject)
  }
}

export const projectService = new ProjectService()

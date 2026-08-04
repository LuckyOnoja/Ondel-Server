import { Response } from 'express'
import { projectService } from './project.service.js'
import { AuthRequest } from '../../middleware/authMiddleware.js'

export async function getProjects(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userIdentifier = req.user?.email || 'default_user'
    const projects = await projectService.getUserProjects(userIdentifier)
    res.status(200).json({ success: true, projects })
  } catch (error: any) {
    console.error('[getProjects error]:', error)
    res.status(500).json({ success: false, message: 'Failed to fetch projects' })
  }
}

export async function createProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, gradient, initialSongTitle, audioFileName, audioUrl } = req.body
    const userIdentifier = req.user?.email || 'default_user'

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, message: 'Project name is required' })
      return
    }

    const project = await projectService.createProject(
      userIdentifier,
      name,
      gradient,
      initialSongTitle,
      audioFileName,
      audioUrl
    )

    res.status(201).json({ success: true, project })
  } catch (error: any) {
    console.error('[createProject error]:', error)
    res.status(500).json({ success: false, message: 'Failed to create project' })
  }
}

export async function addSongToProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const { title, artistName, audioUrl, audioFileName, status, releaseDate } = req.body
    const userIdentifier = req.user?.email || 'default_user'

    if (!title) {
      res.status(400).json({ success: false, message: 'Song title is required' })
      return
    }

    const song = await projectService.addSongToProject(userIdentifier, projectId, {
      title,
      artistName: artistName || 'Artist',
      audioUrl,
      audioFileName,
      status: status || 'Strategy Ready',
      releaseDate,
    })

    res.status(201).json({ success: true, song })
  } catch (error: any) {
    console.error('[addSongToProject error]:', error)
    res.status(500).json({ success: false, message: 'Failed to add song to project' })
  }
}

export async function addVaultItemToProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const { name, type, size, uploadedAt, fileUrl } = req.body
    const userIdentifier = req.user?.email || 'default_user'

    if (!name || !type) {
      res.status(400).json({ success: false, message: 'Vault item name and type are required' })
      return
    }

    const vaultItem = await projectService.addVaultItemToProject(userIdentifier, projectId, {
      name,
      type: type || 'stem',
      size: size || 'Unknown size',
      uploadedAt: uploadedAt || new Date().toISOString().split('T')[0],
      fileUrl,
    })

    res.status(201).json({ success: true, vaultItem })
  } catch (error: any) {
    console.error('[addVaultItemToProject error]:', error)
    res.status(500).json({ success: false, message: 'Failed to add vault item to project' })
  }
}

export async function addCalendarEventToProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const { title, date, category, songTitle } = req.body
    const userIdentifier = req.user?.email || 'default_user'

    if (!title || !date) {
      res.status(400).json({ success: false, message: 'Event title and date are required' })
      return
    }

    const event = await projectService.addCalendarEventToProject(userIdentifier, projectId, {
      title,
      date,
      category: category || 'Release',
      songTitle,
    })

    res.status(201).json({ success: true, event })
  } catch (error: any) {
    console.error('[addCalendarEventToProject error]:', error)
    res.status(500).json({ success: false, message: 'Failed to add calendar event to project' })
  }
}

export async function renameProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const { name } = req.body
    const userIdentifier = req.user?.email || 'default_user'

    if (!name || typeof name !== 'string') {
      res.status(400).json({ success: false, message: 'Project name is required' })
      return
    }

    const project = await projectService.renameProject(userIdentifier, projectId, name)
    res.status(200).json({ success: true, project })
  } catch (error: any) {
    console.error('[renameProject error]:', error)
    res.status(500).json({ success: false, message: 'Failed to rename project' })
  }
}

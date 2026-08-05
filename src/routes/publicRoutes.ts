import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma.js'

const router = Router()

/**
 * Public route to resolve a track or vault item for public listening page
 * GET /api/v1/public/listen?song=him-sk.mp3 (or slug/id)
 */
router.get('/listen', async (req: Request, res: Response): Promise<void> => {
  try {
    const songQuery = String(req.query.song || '').trim()

    if (!songQuery) {
      res.status(400).json({ success: false, message: 'Missing song query parameter' })
      return
    }

    // 1. Check VaultItem by slug or id
    const vaultItem = await prisma.vaultItem.findFirst({
      where: {
        OR: [
          { slug: songQuery },
          { id: songQuery },
          { name: songQuery },
        ],
      },
      include: {
        project: {
          include: {
            user: true,
          },
        },
      },
    })

    if (vaultItem) {
      res.status(200).json({
        success: true,
        track: {
          id: vaultItem.id,
          title: vaultItem.name,
          slug: vaultItem.slug || vaultItem.id,
          fileUrl: vaultItem.fileUrl || 'https://raw.githubusercontent.com/mdn/webaudio-examples/main/audio-analyser/viper.mp3',
          artistName: vaultItem.project?.user?.name || vaultItem.project?.name || 'Independent Artist',
          projectName: vaultItem.project?.name,
          type: vaultItem.type,
          size: vaultItem.size,
          uploadedAt: vaultItem.uploadedAt,
        },
      })
      return
    }

    // 2. Fallback: Check Song by slug or id
    const song = await prisma.song.findFirst({
      where: {
        OR: [
          { slug: songQuery },
          { id: songQuery },
          { title: songQuery },
        ],
      },
      include: {
        artist: true,
      },
    })

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
      })
      return
    }

    res.status(404).json({ success: false, message: 'Track not found' })
  } catch (error: any) {
    console.error('[public/listen error]:', error)
    res.status(500).json({ success: false, message: 'Server error retrieving track' })
  }
})

export default router

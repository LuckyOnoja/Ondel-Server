import { Response } from 'express'
import { AuthRequest } from '../../middleware/authMiddleware.js'
import { OndieService } from './ondie.service.js'

export async function getOndieChats(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const chats = await OndieService.getProjectChats(projectId)
    res.status(200).json({ success: true, chats })
  } catch (error: any) {
    console.error('[getOndieChats error]:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch chat history' })
  }
}

export async function updateOndieMessage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const messageId = String(req.params.messageId)
    const updated = await OndieService.updateChatMessagePayload(projectId, messageId, req.body || {})
    res.status(200).json({ success: true, message: updated })
  } catch (error: any) {
    console.error('[updateOndieMessage error]:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to update message' })
  }
}

export async function deleteOndieChat(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectId = String(req.params.id)
    const chatId = String(req.params.chatId)
    await OndieService.deleteProjectChat(projectId, chatId)
    res.status(200).json({ success: true, message: 'Chat deleted' })
  } catch (error: any) {
    console.error('[deleteOndieChat error]:', error)
    res.status(500).json({ success: false, message: error.message || 'Failed to delete chat' })
  }
}

export async function streamOndieChat(req: AuthRequest, res: Response): Promise<void> {
  const projectId = String(req.params.id)
  const { chatId, message, attachments, turns } = req.body || {}

  const userMessage =
    typeof message === 'string' && message.trim()
      ? message.trim()
      : Array.isArray(turns) && turns.length
        ? String(turns[turns.length - 1]?.content || '').trim()
        : ''

  if (!userMessage) {
    res.status(400).json({ success: false, message: 'Message is required' })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  const emit = (event: any) => {
    if (!res.writableEnded) {
      res.write(`${JSON.stringify(event)}\n`)
    }
  }

  try {
    await OndieService.streamChat(
      projectId,
      { chatId, message: userMessage, attachments, turns },
      emit,
      controller.signal
    )
  } catch (error: any) {
    if (!controller.signal.aborted) {
      emit({ type: 'error', error: error?.message || 'Failed to stream response' })
    }
  } finally {
    if (!res.writableEnded) res.end()
  }
}

export async function streamOndieCaptions(req: AuthRequest, res: Response): Promise<void> {
  const projectId = String(req.params.id)
  const { sections, post } = req.body || {}

  if (!Array.isArray(sections) || !sections.length || !post) {
    res.status(400).json({ success: false, message: 'sections and post are required' })
    return
  }

  res.status(200)
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  const emit = (event: any) => {
    if (!res.writableEnded) {
      res.write(`${JSON.stringify(event)}\n`)
    }
  }

  try {
    await OndieService.streamCaptions(projectId, { sections, post }, emit, controller.signal)
  } catch (error: any) {
    if (!controller.signal.aborted) {
      emit({ type: 'error', error: error?.message || 'Failed to draft captions' })
    }
  } finally {
    if (!res.writableEnded) res.end()
  }
}

export async function streamOndiePitch(req: AuthRequest, res: Response): Promise<void> {
  const projectId = String(req.params.id)
  const { length, existingDraft, pitchRecord } = req.body || {}

  res.status(200)
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.flushHeaders?.()

  const controller = new AbortController()
  res.on('close', () => {
    if (!res.writableEnded) controller.abort()
  })

  const emit = (event: any) => {
    if (!res.writableEnded) {
      res.write(`${JSON.stringify(event)}\n`)
    }
  }

  try {
    await OndieService.streamEditorialPitch(
      projectId,
      {
        length: length === 'short' ? 'short' : 'full',
        existingDraft: typeof existingDraft === 'string' ? existingDraft : undefined,
        pitchRecord: Array.isArray(pitchRecord) ? pitchRecord : undefined,
      },
      emit,
      controller.signal
    )
  } catch (error: any) {
    if (!controller.signal.aborted) {
      emit({ type: 'error', error: error?.message || 'Failed to draft editorial pitch' })
    }
  } finally {
    if (!res.writableEnded) res.end()
  }
}

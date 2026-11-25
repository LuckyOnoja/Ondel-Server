import { Router } from 'express'
import multer from 'multer'
import {
  getProjects,
  createProject,
  updateProject,
  uploadMediaToCloudinary,
  addSongToProject,
  addVaultItemToProject,
  uploadVaultFileToProject,
  deleteVaultItemFromProject,
  getCalendarEvents,
  addCalendarEventToProject,
  batchAddCalendarEvents,
  updateCalendarEvent,
  deleteCalendarEvent,
} from './project.controller.js'
import {
  getOndieChats,
  streamOndieChat,
  updateOndieMessage,
  deleteOndieChat,
  streamOndieCaptions,
  streamOndiePitch,
} from './ondie.controller.js'
import { requireAuth } from '../../middleware/authMiddleware.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB file limit
})

const router = Router()

// Require valid auth token for all project operations
router.use(requireAuth)

router.get('/', getProjects)
router.post('/', createProject)
router.post('/upload', upload.single('file'), uploadMediaToCloudinary)
router.patch('/:id', updateProject)
router.post('/:id/songs', addSongToProject)

// Vault
router.post('/:id/vault', addVaultItemToProject)
router.post('/:id/vault/upload', upload.single('file'), uploadVaultFileToProject)
router.delete('/:id/vault/:vaultItemId', deleteVaultItemFromProject)

// Calendar Events
router.get('/:id/events', getCalendarEvents)
router.post('/:id/events', addCalendarEventToProject)
router.post('/:id/events/batch', batchAddCalendarEvents)
router.patch('/:id/events/:eventId', updateCalendarEvent)
router.delete('/:id/events/:eventId', deleteCalendarEvent)

// Ask Ondie (DeepSeek-powered project assistant + persistent chats)
router.get('/:id/ondie/chats', getOndieChats)
router.delete('/:id/ondie/chats/:chatId', deleteOndieChat)
router.post('/:id/ondie/chat', streamOndieChat)
router.patch('/:id/ondie/messages/:messageId', updateOndieMessage)
router.post('/:id/ondie/captions', streamOndieCaptions)
router.post('/:id/ondie/pitch', streamOndiePitch)

export default router

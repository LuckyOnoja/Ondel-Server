import { Router } from 'express'
import multer from 'multer'
import {
  getProjects,
  createProject,
  addSongToProject,
  addVaultItemToProject,
  uploadVaultFileToProject,
  deleteVaultItemFromProject,
  addCalendarEventToProject,
  renameProject,
} from './project.controller.js'
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
router.patch('/:id', renameProject)
router.post('/:id/songs', addSongToProject)
router.post('/:id/vault', addVaultItemToProject)
router.post('/:id/vault/upload', upload.single('file'), uploadVaultFileToProject)
router.delete('/:id/vault/:vaultItemId', deleteVaultItemFromProject)
router.post('/:id/events', addCalendarEventToProject)

export default router

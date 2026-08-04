import { Router } from 'express'
import {
  getProjects,
  createProject,
  addSongToProject,
  addVaultItemToProject,
  addCalendarEventToProject,
  renameProject,
} from './project.controller.js'
import { requireAuth } from '../../middleware/authMiddleware.js'

const router = Router()

// Require valid auth token for all project operations
router.use(requireAuth)

router.get('/', getProjects)
router.post('/', createProject)
router.patch('/:id', renameProject)
router.post('/:id/songs', addSongToProject)
router.post('/:id/vault', addVaultItemToProject)
router.post('/:id/events', addCalendarEventToProject)

export default router

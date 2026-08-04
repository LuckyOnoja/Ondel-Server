import { Router } from 'express'
import {
  getProjects,
  createProject,
  addSongToProject,
  addVaultItemToProject,
  addCalendarEventToProject,
  renameProject,
} from './project.controller.js'

const router = Router()

router.get('/', getProjects)
router.post('/', createProject)
router.patch('/:id', renameProject)
router.post('/:id/songs', addSongToProject)
router.post('/:id/vault', addVaultItemToProject)
router.post('/:id/events', addCalendarEventToProject)

export default router

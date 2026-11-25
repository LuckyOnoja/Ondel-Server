import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware.js';
import { cacheResponse } from '../middleware/cacheMiddleware.js';
import { prisma } from '../config/prisma.js';

const router = Router();

// Example cached GET endpoint (caches for 60 seconds in Redis)
router.get('/profile', requireAuth, cacheResponse(60), async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user?.userId },
      include: {
        workspaces: {
          include: {
            workspace: true,
          },
        },
      },
    });

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Get persisted user-level preferences & state directly from PostgreSQL
// (theme, notificationPrefs, notificationsRead, exploreSaved, exploreSent)
router.get('/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const preferences =
      user?.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
        ? (user.preferences as Record<string, unknown>)
        : {};

    res.status(200).json({ success: true, preferences });
  } catch (error) {
    console.error('[GET /api/users/preferences error]:', error);
    res.status(500).json({ success: false, message: 'Failed to load user preferences' });
  }
});

// Merge-update user preferences & state directly in PostgreSQL
router.patch('/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const incoming = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { preferences: true },
    });

    const current =
      existingUser?.preferences &&
      typeof existingUser.preferences === 'object' &&
      !Array.isArray(existingUser.preferences)
        ? (existingUser.preferences as Record<string, unknown>)
        : {};

    const next: Record<string, unknown> = { ...current };
    if (incoming.theme === 'light' || incoming.theme === 'dark') {
      next.theme = incoming.theme;
    }
    if (incoming.notificationPrefs && typeof incoming.notificationPrefs === 'object') {
      next.notificationPrefs = {
        ...((current.notificationPrefs as Record<string, unknown>) || {}),
        ...incoming.notificationPrefs,
      };
    }
    if (Array.isArray(incoming.notificationsRead)) {
      next.notificationsRead = incoming.notificationsRead.filter((x: unknown) => typeof x === 'string').slice(-300);
    }
    if (Array.isArray(incoming.exploreSaved)) {
      next.exploreSaved = [...new Set(incoming.exploreSaved.filter((x: unknown) => typeof x === 'string'))];
    }
    if (Array.isArray(incoming.exploreSent)) {
      next.exploreSent = [...new Set(incoming.exploreSent.filter((x: unknown) => typeof x === 'string'))];
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { preferences: next as any },
      select: { preferences: true },
    });

    res.status(200).json({ success: true, preferences: updated.preferences ?? {} });
  } catch (error) {
    console.error('[PATCH /api/users/preferences error]:', error);
    res.status(500).json({ success: false, message: 'Failed to save user preferences' });
  }
});

export default router;

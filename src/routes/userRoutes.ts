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

export default router;

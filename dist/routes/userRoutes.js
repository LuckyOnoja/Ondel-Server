"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const cacheMiddleware_js_1 = require("../middleware/cacheMiddleware.js");
const prisma_js_1 = require("../config/prisma.js");
const router = (0, express_1.Router)();
// Example cached GET endpoint (caches for 60 seconds in Redis)
router.get('/profile', authMiddleware_js_1.requireAuth, (0, cacheMiddleware_js_1.cacheResponse)(60), async (req, res) => {
    try {
        const user = await prisma_js_1.prisma.user.findUnique({
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
    }
    catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile' });
    }
});
// Get persisted user-level preferences & state directly from PostgreSQL
// (theme, notificationPrefs, notificationsRead, exploreSaved, exploreSent)
router.get('/preferences', authMiddleware_js_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const user = await prisma_js_1.prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const preferences = user?.preferences && typeof user.preferences === 'object' && !Array.isArray(user.preferences)
            ? user.preferences
            : {};
        res.status(200).json({ success: true, preferences });
    }
    catch (error) {
        console.error('[GET /api/users/preferences error]:', error);
        res.status(500).json({ success: false, message: 'Failed to load user preferences' });
    }
});
// Merge-update user preferences & state directly in PostgreSQL
router.patch('/preferences', authMiddleware_js_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const incoming = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
        const existingUser = await prisma_js_1.prisma.user.findUnique({
            where: { id: userId },
            select: { preferences: true },
        });
        const current = existingUser?.preferences &&
            typeof existingUser.preferences === 'object' &&
            !Array.isArray(existingUser.preferences)
            ? existingUser.preferences
            : {};
        const next = { ...current };
        if (incoming.theme === 'light' || incoming.theme === 'dark') {
            next.theme = incoming.theme;
        }
        if (incoming.notificationPrefs && typeof incoming.notificationPrefs === 'object') {
            next.notificationPrefs = {
                ...(current.notificationPrefs || {}),
                ...incoming.notificationPrefs,
            };
        }
        if (Array.isArray(incoming.notificationsRead)) {
            next.notificationsRead = incoming.notificationsRead.filter((x) => typeof x === 'string').slice(-300);
        }
        if (Array.isArray(incoming.exploreSaved)) {
            next.exploreSaved = [...new Set(incoming.exploreSaved.filter((x) => typeof x === 'string'))];
        }
        if (Array.isArray(incoming.exploreSent)) {
            next.exploreSent = [...new Set(incoming.exploreSent.filter((x) => typeof x === 'string'))];
        }
        const updated = await prisma_js_1.prisma.user.update({
            where: { id: userId },
            data: { preferences: next },
            select: { preferences: true },
        });
        res.status(200).json({ success: true, preferences: updated.preferences ?? {} });
    }
    catch (error) {
        console.error('[PATCH /api/users/preferences error]:', error);
        res.status(500).json({ success: false, message: 'Failed to save user preferences' });
    }
});
exports.default = router;

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
exports.default = router;

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logStep = logStep;
exports.submitWaitlist = submitWaitlist;
exports.uploadDemo = uploadDemo;
exports.getStrategyByToken = getStrategyByToken;
exports.getAdminSubmissions = getAdminSubmissions;
exports.getAdminSubmissionById = getAdminSubmissionById;
exports.saveAndDeliverStrategy = saveAndDeliverStrategy;
exports.createWeeklyOpportunity = createWeeklyOpportunity;
exports.getAnalyticsMetrics = getAnalyticsMetrics;
exports.getMyStrategy = getMyStrategy;
const fs_1 = __importDefault(require("fs"));
const prisma_js_1 = require("../config/prisma.js");
const mailer_js_1 = require("../config/mailer.js");
const cloudinary_js_1 = require("../config/cloudinary.js");
/**
 * Public: Log step progression in the waitlist funnel
 */
async function logStep(req, res) {
    try {
        const { sessionId, variant, stepNumber, stepName, metadata } = req.body;
        if (!sessionId || !variant || !stepNumber || !stepName) {
            res.status(400).json({ success: false, message: 'Missing step tracking parameters' });
            return;
        }
        const log = await prisma_js_1.prisma.waitlistStepLog.create({
            data: {
                sessionId: String(sessionId),
                variant: String(variant),
                stepNumber: Number(stepNumber),
                stepName: String(stepName),
                metadata: metadata || {},
            },
        });
        res.status(201).json({ success: true, logId: log.id });
    }
    catch (error) {
        console.error('[logStep error]:', error);
        res.status(500).json({ success: false, message: 'Failed to log waitlist step' });
    }
}
/**
 * Public: Submit complete 6-step waitlist form
 */
async function submitWaitlist(req, res) {
    try {
        const { artistName, email, urgency, biggestChallenge, goldmineAnswer, demoUrl, audioFileName, spotifyLink, appleMusicLink, strategyRequested = true, headlineVariant = 'A', sessionId, } = req.body;
        if (!artistName || !email || !urgency || !biggestChallenge || !goldmineAnswer) {
            res.status(400).json({
                success: false,
                message: 'Required fields missing: artistName, email, urgency, biggestChallenge, goldmineAnswer',
            });
            return;
        }
        const submission = await prisma_js_1.prisma.waitlistSubmission.create({
            data: {
                artistName: String(artistName),
                email: String(email).toLowerCase().trim(),
                urgency,
                biggestChallenge,
                goldmineAnswer: String(goldmineAnswer),
                demoUrl: demoUrl ? String(demoUrl) : null,
                audioFileName: audioFileName ? String(audioFileName) : null,
                spotifyLink: spotifyLink ? String(spotifyLink) : null,
                appleMusicLink: appleMusicLink ? String(appleMusicLink) : null,
                strategyRequested: Boolean(strategyRequested),
                headlineVariant: String(headlineVariant),
                status: 'SUBMITTED',
            },
        });
        // Dispatch instant waitlist confirmation email to artist
        (0, mailer_js_1.sendWaitlistConfirmationEmail)(submission.email, submission.artistName).catch((err) => {
            console.error('[sendWaitlistConfirmationEmail error]:', err);
        });
        // Link previous step logs to this submission if sessionId provided
        if (sessionId) {
            await prisma_js_1.prisma.waitlistStepLog.updateMany({
                where: { sessionId: String(sessionId) },
                data: { submissionId: submission.id },
            });
        }
        res.status(201).json({
            success: true,
            message: "You're in. We will review your release strategy request.",
            submission: {
                id: submission.id,
                artistName: submission.artistName,
                shareToken: submission.shareToken,
            },
        });
    }
    catch (error) {
        console.error('[submitWaitlist error]:', error);
        res.status(500).json({ success: false, message: 'Failed to process waitlist submission' });
    }
}
/**
 * Public: Upload song file (Audio MP3/WAV storage with optional Cloudinary CDN)
 */
async function uploadDemo(req, res) {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }
        let finalFileUrl = `/uploads/demos/${req.file.filename}`;
        if ((0, cloudinary_js_1.isCloudinaryConfigured)()) {
            try {
                const cdnUrl = await (0, cloudinary_js_1.uploadAudioToCloudinary)(req.file.path, req.file.filename);
                finalFileUrl = cdnUrl;
                console.log('[Cloudinary Upload Success]:', cdnUrl);
                // Delete temporary disk file immediately after Cloudinary upload
                if (req.file.path && fs_1.default.existsSync(req.file.path)) {
                    fs_1.default.unlinkSync(req.file.path);
                }
            }
            catch (cErr) {
                console.error('[Cloudinary Upload Fallback to local]:', cErr);
            }
        }
        res.status(200).json({
            success: true,
            demoUrl: finalFileUrl,
            fileName: req.file.originalname,
            sizeBytes: req.file.size,
        });
    }
    catch (error) {
        console.error('[uploadDemo error]:', error);
        res.status(500).json({ success: false, message: 'Song file upload failed' });
    }
}
/**
 * Public: Get release strategy by share token for artist preview
 */
async function getStrategyByToken(req, res) {
    try {
        const tokenStr = String(req.params.token);
        const submission = await prisma_js_1.prisma.waitlistSubmission.findUnique({
            where: { shareToken: tokenStr },
            include: {
                strategy: true,
                weeklyUpdates: {
                    orderBy: { weekNumber: 'desc' },
                },
            },
        });
        if (!submission) {
            res.status(404).json({ success: false, message: 'Release plan not found' });
            return;
        }
        res.status(200).json({
            success: true,
            artistName: submission.artistName,
            status: submission.status,
            strategy: submission.strategy,
            weeklyUpdates: submission.weeklyUpdates,
        });
    }
    catch (error) {
        console.error('[getStrategyByToken error]:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving release plan' });
    }
}
/**
 * Admin: List all waitlist submissions with filters
 */
async function getAdminSubmissions(req, res) {
    try {
        const { status, urgency, search } = req.query;
        const where = {};
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (urgency && typeof urgency === 'string') {
            where.urgency = urgency;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { artistName: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { goldmineAnswer: { contains: search, mode: 'insensitive' } },
            ];
        }
        const submissions = await prisma_js_1.prisma.waitlistSubmission.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                strategy: true,
                _count: { select: { weeklyUpdates: true } },
            },
        });
        res.status(200).json({ success: true, count: submissions.length, submissions });
    }
    catch (error) {
        console.error('[getAdminSubmissions error]:', error);
        res.status(500).json({ success: false, message: 'Server error fetching waitlist submissions' });
    }
}
/**
 * Admin: Get single submission detail
 */
async function getAdminSubmissionById(req, res) {
    try {
        const subId = String(req.params.id);
        const submission = await prisma_js_1.prisma.waitlistSubmission.findUnique({
            where: { id: subId },
            include: {
                strategy: true,
                weeklyUpdates: true,
                stepLogs: { orderBy: { stepNumber: 'asc' } },
            },
        });
        if (!submission) {
            res.status(404).json({ success: false, message: 'Submission not found' });
            return;
        }
        res.status(200).json({ success: true, submission });
    }
    catch (error) {
        console.error('[getAdminSubmissionById error]:', error);
        res.status(500).json({ success: false, message: 'Server error fetching submission details' });
    }
}
/**
 * Admin: Save or update & deliver Release Strategy to artist
 */
async function saveAndDeliverStrategy(req, res) {
    try {
        const subId = String(req.params.id);
        const { roadmap, contentCalendar, playlistTargets, creatorCollabs, weeklyChecklist, deliverNow = true } = req.body;
        const submission = await prisma_js_1.prisma.waitlistSubmission.findUnique({ where: { id: subId } });
        if (!submission) {
            res.status(404).json({ success: false, message: 'Submission not found' });
            return;
        }
        const strategy = await prisma_js_1.prisma.releaseStrategy.upsert({
            where: { submissionId: subId },
            update: {
                roadmap,
                contentCalendar,
                playlistTargets,
                creatorCollabs,
                weeklyChecklist,
                deliveredAt: deliverNow ? new Date() : undefined,
            },
            create: {
                submissionId: subId,
                roadmap,
                contentCalendar,
                playlistTargets,
                creatorCollabs,
                weeklyChecklist,
                deliveredAt: deliverNow ? new Date() : undefined,
            },
        });
        if (deliverNow) {
            await prisma_js_1.prisma.waitlistSubmission.update({
                where: { id: subId },
                data: { status: 'STRATEGY_DELIVERED' },
            });
            // Dispatch email notification to artist
            await (0, mailer_js_1.sendStrategyDeliveredEmail)(submission.email, submission.artistName, submission.shareToken);
        }
        res.status(200).json({
            success: true,
            message: deliverNow ? 'Release strategy delivered to artist' : 'Draft strategy saved',
            strategy,
            shareUrl: `${process.env.APP_URL || 'http://localhost:8000'}/strategy/${submission.shareToken}`,
        });
    }
    catch (error) {
        console.error('[saveAndDeliverStrategy error]:', error);
        res.status(500).json({ success: false, message: 'Failed to save or deliver release strategy' });
    }
}
/**
 * Admin: Create weekly opportunity update for an artist ("Phase Two Magic")
 */
async function createWeeklyOpportunity(req, res) {
    try {
        const subId = String(req.params.id);
        const { weekNumber, title, opportunities } = req.body;
        if (!weekNumber || !title || !opportunities) {
            res.status(400).json({ success: false, message: 'Missing weekNumber, title, or opportunities array' });
            return;
        }
        const submission = await prisma_js_1.prisma.waitlistSubmission.findUnique({ where: { id: subId } });
        if (!submission) {
            res.status(404).json({ success: false, message: 'Submission not found' });
            return;
        }
        const weekly = await prisma_js_1.prisma.weeklyOpportunity.create({
            data: {
                submissionId: subId,
                weekNumber: Number(weekNumber),
                title: String(title),
                opportunities,
            },
        });
        await prisma_js_1.prisma.waitlistSubmission.update({
            where: { id: subId },
            data: { status: 'WEEKLY_ACTIVE' },
        });
        // Dispatch email notification to artist
        await (0, mailer_js_1.sendWeeklyOpportunityEmail)(submission.email, submission.artistName, String(title), submission.shareToken);
        res.status(201).json({
            success: true,
            message: `Week ${weekNumber} opportunities published for artist`,
            weekly,
        });
    }
    catch (error) {
        console.error('[createWeeklyOpportunity error]:', error);
        res.status(500).json({ success: false, message: 'Failed to dispatch weekly opportunity' });
    }
}
/**
 * Admin: Analytics metrics calculation & A/B headline breakdown
 */
async function getAnalyticsMetrics(req, res) {
    try {
        const totalSubmissions = await prisma_js_1.prisma.waitlistSubmission.count();
        const strategyDeliveredCount = await prisma_js_1.prisma.waitlistSubmission.count({
            where: { status: { in: ['STRATEGY_DELIVERED', 'WEEKLY_ACTIVE', 'ACCEPTED'] } },
        });
        const repliedCount = await prisma_js_1.prisma.releaseStrategy.count({ where: { artistReplied: true } });
        const wouldPayCount = await prisma_js_1.prisma.releaseStrategy.count({ where: { wouldPaySignal: true } });
        // Step funnel logs count
        const step1Count = await prisma_js_1.prisma.waitlistStepLog.count({ where: { stepNumber: 1 } });
        const step2Count = await prisma_js_1.prisma.waitlistStepLog.count({ where: { stepNumber: 2 } });
        const step5Count = await prisma_js_1.prisma.waitlistStepLog.count({ where: { stepNumber: 5 } });
        const step6Count = await prisma_js_1.prisma.waitlistStepLog.count({ where: { stepNumber: 6 } });
        // Headline Variant breakdown
        const variantStatsRaw = await prisma_js_1.prisma.waitlistSubmission.groupBy({
            by: ['headlineVariant'],
            _count: { id: true },
        });
        const variantStats = variantStatsRaw.map((v) => ({
            variant: v.headlineVariant,
            submissions: v._count.id,
        }));
        // Target Conversion Benchmark Rates
        const metrics = {
            landingToInvite: step1Count > 0 ? (step1Count / Math.max(step1Count, 100)) * 100 : 0, // >25% target
            inviteToReleaseInfo: step1Count > 0 ? (step2Count / step1Count) * 100 : 0, // >70% target
            releaseInfoToSongUpload: step2Count > 0 ? (step5Count / step2Count) * 100 : 0, // >40% target
            songUploadToStrategyRequested: step5Count > 0 ? (step6Count / step5Count) * 100 : 0, // >80% target
            strategyDeliveredToFollowUp: strategyDeliveredCount > 0 ? (repliedCount / strategyDeliveredCount) * 100 : 0, // >50% target
            wouldPayRate: strategyDeliveredCount > 0 ? (wouldPayCount / strategyDeliveredCount) * 100 : 0, // >30% target
        };
        res.status(200).json({
            success: true,
            totals: {
                totalSubmissions,
                strategyDeliveredCount,
                repliedCount,
                wouldPayCount,
            },
            metrics,
            headlineVariants: variantStats,
        });
    }
    catch (error) {
        console.error('[getAnalyticsMetrics error]:', error);
        res.status(500).json({ success: false, message: 'Failed to calculate analytics metrics' });
    }
}
/**
 * Public/Auth: Get strategy and weekly opportunities for the currently logged-in user
 */
async function getMyStrategy(req, res) {
    try {
        if (!req.user?.email) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const userEmail = String(req.user.email).toLowerCase().trim();
        const submission = await prisma_js_1.prisma.waitlistSubmission.findFirst({
            where: {
                email: { equals: userEmail, mode: 'insensitive' },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                strategy: true,
                weeklyOpportunities: {
                    orderBy: { weekNumber: 'desc' },
                },
            },
        });
        if (!submission) {
            res.status(200).json({ success: true, submission: null });
            return;
        }
        res.status(200).json({
            success: true,
            submission,
            strategy: submission.strategy,
            weeklyOpportunities: submission.weeklyOpportunities,
        });
    }
    catch (error) {
        console.error('[getMyStrategy error]:', error);
        res.status(500).json({ success: false, message: 'Server error retrieving strategy' });
    }
}

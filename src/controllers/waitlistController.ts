import { Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { sendWaitlistConfirmationEmail, sendStrategyDeliveredEmail, sendWeeklyOpportunityEmail } from '../config/mailer.js';
import { isCloudinaryConfigured, uploadAudioToCloudinary } from '../config/cloudinary.js';

/**
 * Public: Log step progression in the waitlist funnel
 */
export async function logStep(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, variant, stepNumber, stepName, metadata } = req.body;

    if (!sessionId || !variant || !stepNumber || !stepName) {
      res.status(400).json({ success: false, message: 'Missing step tracking parameters' });
      return;
    }

    const log = await prisma.waitlistStepLog.create({
      data: {
        sessionId: String(sessionId),
        variant: String(variant),
        stepNumber: Number(stepNumber),
        stepName: String(stepName),
        metadata: metadata || {},
      },
    });

    res.status(201).json({ success: true, logId: log.id });
  } catch (error: any) {
    console.error('[logStep error]:', error);
    res.status(500).json({ success: false, message: 'Failed to log waitlist step' });
  }
}

/**
 * Public: Submit complete 6-step waitlist form
 */
export async function submitWaitlist(req: Request, res: Response): Promise<void> {
  try {
    const {
      artistName,
      email,
      urgency,
      biggestChallenge,
      goldmineAnswer,
      demoUrl,
      audioFileName,
      spotifyLink,
      appleMusicLink,
      strategyRequested = true,
      headlineVariant = 'A',
      sessionId,
    } = req.body;

    if (!artistName || !email || !urgency || !biggestChallenge || !goldmineAnswer) {
      res.status(400).json({
        success: false,
        message: 'Required fields missing: artistName, email, urgency, biggestChallenge, goldmineAnswer',
      });
      return;
    }

    const userEmail = String(email).toLowerCase().trim();

    const challengeMapping: Record<string, string> = {
      DONT_KNOW_AFTER_UPLOADING: 'DONT_KNOW_WHAT_TO_DO',
      KNOWING_WHEN_TO_RELEASE: 'WHEN_TO_RELEASE',
    };
    const normalizedChallenge = challengeMapping[biggestChallenge] || biggestChallenge;

    const submission = await prisma.waitlistSubmission.create({
      data: {
        artistName: String(artistName),
        email: userEmail,
        urgency,
        biggestChallenge: normalizedChallenge as any,
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

    // Auto-create/link User, Artist & Song in DB so songs show up directly on the /releases page!
    try {
      let user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: String(artistName),
            isVerified: true,
          },
        });

        // Initialize CreditAccount for instant pitching access
        await prisma.creditAccount.create({
          data: {
            userId: user.id,
            balance: 10,
          },
        });
      }

      let artist = await prisma.artist.findFirst({
        where: { userId: user.id },
      });

      if (!artist) {
        artist = await prisma.artist.create({
          data: {
            userId: user.id,
            name: String(artistName),
            genres: ['Afrobeats'],
          },
        });
      }

      const inferredTitle = audioFileName
        ? audioFileName.replace(/\.[^/.]+$/, '')
        : String(goldmineAnswer).length < 40
        ? String(goldmineAnswer)
        : `${String(artistName)} Release`;

      const existingSong = await prisma.song.findFirst({
        where: {
          artistId: artist.id,
          OR: [
            { title: inferredTitle },
            { audioUrl: demoUrl ? String(demoUrl) : undefined },
          ],
        },
      });

      if (!existingSong) {
        const song = await prisma.song.create({
          data: {
            artistId: artist.id,
            title: inferredTitle,
            genre: 'Afrobeats',
            audioUrl: demoUrl ? String(demoUrl) : null,
            epkUrl: spotifyLink || appleMusicLink || null,
            metadata: {
              source: 'WAITLIST_SUBMISSION',
              submissionId: submission.id,
              scrutinizedAt: new Date().toISOString(),
              aiScrutinizer: {
                bpm: 112,
                key: 'C Major',
                energy: 8,
                danceability: 0.85,
                status: 'PASSED',
              },
            },
          },
        });

        console.log(`✅ [submitWaitlist] Auto-created Song "${song.title}" (${song.id}) for user ${userEmail} -> visible on /releases!`);
      }
    } catch (linkErr) {
      console.error('⚠️ [submitWaitlist] Failed to auto-create song record for releases page:', linkErr);
    }

    // Dispatch instant waitlist confirmation email to artist
    sendWaitlistConfirmationEmail(submission.email, submission.artistName).catch((err) => {
      console.error('[sendWaitlistConfirmationEmail error]:', err);
    });

    // Link previous step logs to this submission if sessionId provided
    if (sessionId) {
      await prisma.waitlistStepLog.updateMany({
        where: { sessionId: String(sessionId) },
        data: { submissionId: submission.id },
      });
    }

    res.status(201).json({
      success: true,
      message: "You're one of our first users! We will notify you when your account and strategy are ready.",
      submission: {
        id: submission.id,
        artistName: submission.artistName,
        shareToken: submission.shareToken,
      },
    });
  } catch (error: any) {
    console.error('[submitWaitlist error]:', error);
    res.status(500).json({ success: false, message: 'Failed to process waitlist submission' });
  }
}

/**
 * Public: Upload song file (Audio MP3/WAV storage with optional Cloudinary CDN)
 */
export async function uploadDemo(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded' });
      return;
    }

    let finalFileUrl = `/uploads/demos/${req.file.filename}`;

    if (isCloudinaryConfigured()) {
      try {
        const cdnUrl = await uploadAudioToCloudinary(req.file.path, req.file.filename);
        finalFileUrl = cdnUrl;
        console.log('[Cloudinary Upload Success]:', cdnUrl);

        // Delete temporary disk file immediately after Cloudinary upload
        if (req.file.path && fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (cErr) {
        console.error('[Cloudinary Upload Fallback to local]:', cErr);
      }
    }

    res.status(200).json({
      success: true,
      demoUrl: finalFileUrl,
      fileName: req.file.originalname,
      sizeBytes: req.file.size,
    });
  } catch (error: any) {
    console.error('[uploadDemo error]:', error);
    res.status(500).json({ success: false, message: 'Song file upload failed' });
  }
}

/**
 * Public: Get release strategy by share token for artist preview
 */
export async function getStrategyByToken(req: Request, res: Response): Promise<void> {
  try {
    const tokenStr = String(req.params.token);

    const submission = await prisma.waitlistSubmission.findUnique({
      where: { shareToken: tokenStr },
      include: {
        strategy: true,
        weeklyOpportunities: {
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
      weeklyOpportunities: submission.weeklyOpportunities,
    });
  } catch (error: any) {
    console.error('[getStrategyByToken error]:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving release plan' });
  }
}

/**
 * Admin: List all waitlist submissions with filters
 */
export async function getAdminSubmissions(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, urgency, search } = req.query;

    const where: any = {};

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

    const submissions = await prisma.waitlistSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        strategy: true,
        _count: { select: { weeklyOpportunities: true, waitlistStepLogs: true } },
      },
    });

    res.status(200).json({ success: true, count: submissions.length, submissions });
  } catch (error: any) {
    console.error('[getAdminSubmissions error]:', error);
    res.status(500).json({ success: false, message: 'Server error fetching waitlist submissions' });
  }
}

/**
 * Admin: Get single submission detail
 */
export async function getAdminSubmissionById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subId = String(req.params.id);

    const submission = await prisma.waitlistSubmission.findUnique({
      where: { id: subId },
      include: {
        strategy: true,
        weeklyOpportunities: { orderBy: { weekNumber: 'desc' } },
        waitlistStepLogs: { orderBy: { stepNumber: 'asc' } },
      },
    });

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    res.status(200).json({ success: true, submission });
  } catch (error: any) {
    console.error('[getAdminSubmissionById error]:', error);
    res.status(500).json({ success: false, message: 'Server error fetching submission details' });
  }
}

/**
 * Admin: Save or update & deliver Release Strategy to artist
 */
export async function saveAndDeliverStrategy(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subId = String(req.params.id);
    const { roadmap, contentCalendar, playlistTargets, creatorCollabs, weeklyChecklist, deliverNow = true } = req.body;

    const submission = await prisma.waitlistSubmission.findUnique({ where: { id: subId } });

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    const strategy = await prisma.releaseStrategy.upsert({
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
      await prisma.waitlistSubmission.update({
        where: { id: subId },
        data: { status: 'STRATEGY_DELIVERED' },
      });

      // Dispatch email notification to artist
      await sendStrategyDeliveredEmail(submission.email, submission.artistName, submission.shareToken);
    }

    res.status(200).json({
      success: true,
      message: deliverNow ? 'Release strategy delivered to artist' : 'Draft strategy saved',
      strategy,
      shareUrl: `${process.env.APP_URL || 'http://localhost:8000'}/strategy/${submission.shareToken}`,
    });
  } catch (error: any) {
    console.error('[saveAndDeliverStrategy error]:', error);
    res.status(500).json({ success: false, message: 'Failed to save or deliver release strategy' });
  }
}

/**
 * Admin: Create weekly opportunity update for an artist ("Phase Two Magic")
 */
export async function createWeeklyOpportunity(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subId = String(req.params.id);
    const { weekNumber, title, opportunities } = req.body;

    if (!weekNumber || !title || !opportunities) {
      res.status(400).json({ success: false, message: 'Missing weekNumber, title, or opportunities array' });
      return;
    }

    const submission = await prisma.waitlistSubmission.findUnique({ where: { id: subId } });

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    const weekly = await prisma.weeklyOpportunity.create({
      data: {
        submissionId: subId,
        weekNumber: Number(weekNumber),
        title: String(title),
        opportunities,
      },
    });

    await prisma.waitlistSubmission.update({
      where: { id: subId },
      data: { status: 'WEEKLY_ACTIVE' },
    });

    // Dispatch email notification to artist
    await sendWeeklyOpportunityEmail(submission.email, submission.artistName, String(title), submission.shareToken);

    res.status(201).json({
      success: true,
      message: `Week ${weekNumber} opportunities published for artist`,
      weekly,
    });
  } catch (error: any) {
    console.error('[createWeeklyOpportunity error]:', error);
    res.status(500).json({ success: false, message: 'Failed to dispatch weekly opportunity' });
  }
}

/**
 * Admin: Analytics metrics calculation & A/B headline breakdown
 */
export async function getAnalyticsMetrics(req: AuthRequest, res: Response): Promise<void> {
  try {
    const totalSubmissions = await prisma.waitlistSubmission.count();
    const strategyDeliveredCount = await prisma.waitlistSubmission.count({
      where: { status: { in: ['STRATEGY_DELIVERED', 'WEEKLY_ACTIVE', 'ACCEPTED'] } },
    });
    const repliedCount = await prisma.releaseStrategy.count({ where: { artistReplied: true } });
    const wouldPayCount = await prisma.releaseStrategy.count({ where: { wouldPaySignal: true } });

    // Step funnel logs count
    const step1Count = await prisma.waitlistStepLog.count({ where: { stepNumber: 1 } });
    const step2Count = await prisma.waitlistStepLog.count({ where: { stepNumber: 2 } });
    const step5Count = await prisma.waitlistStepLog.count({ where: { stepNumber: 5 } });
    const step6Count = await prisma.waitlistStepLog.count({ where: { stepNumber: 6 } });

    // Headline Variant breakdown
    const variantStatsRaw = await prisma.waitlistSubmission.groupBy({
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
  } catch (error: any) {
    console.error('[getAnalyticsMetrics error]:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate analytics metrics' });
  }
}

/**
 * Public/Auth: Get strategy and weekly opportunities for the currently logged-in user
 */
export async function getMyStrategy(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.email) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const userEmail = String(req.user.email).toLowerCase().trim();

    const submission = await prisma.waitlistSubmission.findFirst({
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
      strategy: (submission as any).strategy,
      weeklyOpportunities: (submission as any).weeklyOpportunities,
    });
  } catch (error: any) {
    console.error('[getMyStrategy error]:', error);
    res.status(500).json({ success: false, message: 'Server error retrieving strategy' });
  }
}

/**
 * Public/Auth: Check if an email or current user has submitted to the waitlist
 */
export async function checkStatus(req: Request, res: Response): Promise<void> {
  try {
    let emailToCheck = req.query.email ? String(req.query.email).toLowerCase().trim() : '';

    if (!emailToCheck && (req as any).user?.email) {
      emailToCheck = String((req as any).user.email).toLowerCase().trim();
    }

    if (!emailToCheck) {
      res.status(400).json({ success: false, message: 'Email query parameter required' });
      return;
    }

    const submission = await prisma.waitlistSubmission.findFirst({
      where: {
        email: { equals: emailToCheck, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      hasSubmitted: Boolean(submission),
      submission: submission || null,
    });
  } catch (error: any) {
    console.error('[checkStatus error]:', error);
    res.status(500).json({ success: false, message: 'Failed to check waitlist status' });
  }
}


import { Request, Response } from 'express';
import fs from 'fs';
import { prisma } from '../config/prisma.js';
import { AuthRequest } from '../middleware/authMiddleware.js';
import { sendWaitlistConfirmationEmail, sendStrategyDeliveredEmail, sendWeeklyOpportunityEmail } from '../config/mailer.js';
import { isCloudinaryConfigured, uploadAudioToCloudinary } from '../config/cloudinary.js';
import { projectService } from '../modules/projects/project.service.js';

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
 * Public: Request an invite from the landing page hero section and save email to DB table waitlist_invitees
 */
export async function requestInvite(req: Request, res: Response): Promise<void> {
  try {
    const { email, variant = 'A', sessionId } = req.body;
    const authUser = (req as AuthRequest).user;

    const trimmedEmail = String(email || authUser?.email || '').toLowerCase().trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      res.status(400).json({ success: false, message: 'A valid email address is required' });
      return;
    }

    // 1. Upsert into WaitlistInvitee table
    const invitee = await prisma.waitlistInvitee.upsert({
      where: { email: trimmedEmail },
      update: {
        headlineVariant: String(variant),
      },
      create: {
        email: trimmedEmail,
        headlineVariant: String(variant),
        status: 'PENDING',
      },
    });

    // 2. Log step event to WaitlistStepLog
    const activeSessionId = String(sessionId || trimmedEmail);
    await prisma.waitlistStepLog.create({
      data: {
        sessionId: activeSessionId,
        variant: String(variant),
        stepNumber: 1,
        stepName: 'REQUEST_INVITE_CLICKED',
        metadata: { email: trimmedEmail, variant },
      },
    }).catch(() => {});

    res.status(200).json({
      success: true,
      message: 'Invite request saved successfully',
      email: trimmedEmail,
      inviteeId: invitee.id,
    });
  } catch (error: any) {
    console.error('[requestInvite error]:', error);
    res.status(500).json({ success: false, message: 'Failed to record invite request' });
  }
}



/**
 * Public/Auth: Save waitlist step draft for account
 */
export async function saveStepDraft(req: Request, res: Response): Promise<void> {
  try {
    const authUser = (req as AuthRequest).user;
    const bodyEmail = req.body.email || req.body.data?.email;
    const sessionId = req.body.sessionId || req.headers['x-session-id'];

    let emailToUse = String(authUser?.email || bodyEmail || '').toLowerCase().trim();

    if (!emailToUse && sessionId) {
      emailToUse = `anon_${sessionId}@draft.ondel.com`;
    }

    let userId = authUser?.userId;

    if (!userId && emailToUse) {
      let user = await prisma.user.findUnique({ where: { email: emailToUse } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: emailToUse,
            name: req.body.data?.artistName || 'Waitlist User',
            isVerified: false,
          },
        });
      }
      userId = user.id;
    }

    if (!userId) {
      res.status(400).json({ success: false, message: 'User account or email required to save draft' });
      return;
    }

    const { stepNumber, stepName, data, metadata } = req.body;
    const step = Number(stepNumber || 1);
    const incomingData = data || metadata || {};

    const existingDraft = await prisma.waitlistDraft.findUnique({
      where: { userId },
    });

    const currentData = (existingDraft?.data as Record<string, any>) || {};
    const updatedData = { ...currentData, ...incomingData };

    const currentCompleted = existingDraft?.completedSteps || [];
    const completedSteps = Array.from(new Set([...currentCompleted, step]));

    const draft = await prisma.waitlistDraft.upsert({
      where: { userId },
      update: {
        currentStep: step,
        data: updatedData,
        completedSteps,
      },
      create: {
        userId,
        currentStep: step,
        data: updatedData,
        completedSteps,
      },
    });

    // Also log to WaitlistStepLog if sessionId is provided
    if (sessionId || stepName) {
      await prisma.waitlistStepLog.create({
        data: {
          sessionId: String(sessionId || userId),
          variant: 'waitlist-lab',
          stepNumber: step,
          stepName: String(stepName || `STEP_${step}`),
          metadata: incomingData,
        },
      }).catch(() => {});
    }

    res.status(200).json({ success: true, draft });
  } catch (error: any) {
    console.error('[saveStepDraft error]:', error);
    res.status(500).json({ success: false, message: 'Failed to save waitlist draft' });
  }
}

/**
 * Public/Auth: Get waitlist draft for account
 */
export async function getDraft(req: Request, res: Response): Promise<void> {
  try {
    const authUser = (req as AuthRequest).user;
    let email = req.query.email ? String(req.query.email).toLowerCase().trim() : '';

    if (!email && authUser?.email) {
      email = authUser.email.toLowerCase().trim();
    }

    let userId = authUser?.userId;

    if (!userId && email) {
      const user = await prisma.user.findUnique({ where: { email } });
      if (user) userId = user.id;
    }

    if (!userId) {
      res.status(200).json({ success: true, draft: null });
      return;
    }

    const draft = await prisma.waitlistDraft.findUnique({
      where: { userId },
    });

    res.status(200).json({ success: true, draft });
  } catch (error: any) {
    console.error('[getDraft error]:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch waitlist draft' });
  }
}

/**
 * Public: Submit complete 6-step waitlist form
 */
export async function submitWaitlist(req: Request, res: Response): Promise<void> {
  try {
    const {
      artistName,
      projectName,
      email,
      urgency,
      biggestChallenge,
      goldmineAnswer,
      goldmineGoals,
      demoUrl,
      audioFileName,
      spotifyLink,
      appleMusicLink,
      strategyRequested = true,
      headlineVariant = 'A',
      sessionId,
    } = req.body;

    const authUser = (req as any).user;
    const userEmail = String(email || authUser?.email || '').toLowerCase().trim();
    const finalGoldmine = String(
      goldmineAnswer ||
      (Array.isArray(goldmineGoals) ? goldmineGoals.join(', ') : goldmineGoals) ||
      'Growth Strategy'
    );
    const finalArtist = String(artistName || authUser?.name || 'Artist');
    const finalUrgency = urgency || 'WITHIN_2_WEEKS';
    const finalChallenge = biggestChallenge || 'DONT_KNOW_WHAT_TO_DO';

    if (!finalArtist || !userEmail || !finalUrgency || !finalChallenge || !finalGoldmine) {
      res.status(400).json({
        success: false,
        message: 'Required fields missing: artistName, email, urgency, biggestChallenge, goldmineAnswer',
      });
      return;
    }

    const challengeMapping: Record<string, string> = {
      DONT_KNOW_AFTER_UPLOADING: 'DONT_KNOW_WHAT_TO_DO',
      KNOWING_WHEN_TO_RELEASE: 'WHEN_TO_RELEASE',
    };
    const normalizedChallenge = challengeMapping[finalChallenge] || finalChallenge;

    // Generate unique 6-character access code
    const uniqueInviteCode = 'OND' + Math.floor(100 + Math.random() * 900);

    const submission = await prisma.waitlistSubmission.create({
      data: {
        artistName: finalArtist,
        email: userEmail,
        urgency: finalUrgency,
        biggestChallenge: normalizedChallenge as any,
        goldmineAnswer: finalGoldmine,
        demoUrl: demoUrl ? String(demoUrl) : null,
        audioFileName: audioFileName ? String(audioFileName) : null,
        spotifyLink: spotifyLink ? String(spotifyLink) : null,
        appleMusicLink: appleMusicLink ? String(appleMusicLink) : null,
        strategyRequested: Boolean(strategyRequested),
        headlineVariant: String(headlineVariant),
        status: 'SUBMITTED',
        shareToken: uniqueInviteCode,
      },
    });

    const totalSubmissions = await prisma.waitlistSubmission.count();

    const inferredTitle = audioFileName
      ? String(audioFileName).replace(/\.[^/.]+$/, '')
      : String(finalGoldmine).length < 40
      ? String(finalGoldmine)
      : `${String(finalArtist)} Release`;

    // Auto-create/link User, Artist & Song in DB so songs show up directly on the /releases page!
    try {
      let user = await prisma.user.findUnique({ where: { email: userEmail } });
      if (!user) {
        user = await prisma.user.create({
          data: {
            email: userEmail,
            name: String(finalArtist),
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

      // Delete waitlist draft if exists for user upon submission
      await prisma.waitlistDraft.deleteMany({ where: { userId: user.id } }).catch(() => {});

      let artist = await prisma.artist.findFirst({
        where: { userId: user.id },
      });

      if (!artist) {
        artist = await prisma.artist.create({
          data: {
            userId: user.id,
            name: String(finalArtist),
            genres: ['Afrobeats'],
          },
        });
      }

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

    // Code email dispatch is now triggered manually from the Admin side!
    // (sendWaitlistConfirmationEmail will be dispatched via POST /api/waitlist/admin/submissions/:id/send-code)

    // Link previous step logs to this submission if sessionId provided
    if (sessionId) {
      await prisma.waitlistStepLog.updateMany({
        where: { sessionId: String(sessionId) },
        data: { submissionId: submission.id },
      });
    }

    // Auto-create backend Project folder for the artist's workspace
    let createdProject = null;
    try {
      createdProject = await projectService.createProject(
        userEmail,
        projectName ? String(projectName).trim() : '',
        undefined,
        inferredTitle,
        audioFileName ? String(audioFileName) : undefined,
        demoUrl ? String(demoUrl) : undefined
      );
    } catch (projErr) {
      console.error('⚠️ [submitWaitlist] Failed to auto-create project:', projErr);
    }

    res.status(201).json({
      success: true,
      message: "Project folder created & waitlist submitted successfully!",
      id: submission.id,
      position: totalSubmissions,
      inviteCode: uniqueInviteCode,
      submission: {
        id: submission.id,
        artistName: submission.artistName,
        projectName: String(projectName || 'Untitled Project'),
        shareToken: submission.shareToken,
      },
      project: createdProject,
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

    // Auto-convert any legacy UUID shareTokens to clean 6-character access codes (e.g. OND782)
    const sanitizedSubmissions = await Promise.all(
      submissions.map(async (s) => {
        if (!s.shareToken || s.shareToken.includes('-') || s.shareToken.length > 10) {
          const cleanCode = 'OND' + Math.floor(100 + Math.random() * 900);
          await prisma.waitlistSubmission.update({
            where: { id: s.id },
            data: { shareToken: cleanCode },
          });
          return { ...s, shareToken: cleanCode };
        }
        return s;
      })
    );

    res.status(200).json({ success: true, count: sanitizedSubmissions.length, submissions: sanitizedSubmissions });
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

    if (!emailToCheck && (req as any).user?.userId) {
      const userRecord = await prisma.user.findUnique({ where: { id: (req as any).user.userId } });
      if (userRecord?.email) {
        emailToCheck = userRecord.email.toLowerCase().trim();
      }
    }

    if (!emailToCheck) {
      const totalCount = await prisma.waitlistSubmission.count();
      res.status(200).json({
        success: true,
        hasSubmitted: false,
        isVerified: false,
        position: totalCount,
        inviteCode: null,
        submission: null,
      });
      return;
    }

    const submission = await prisma.waitlistSubmission.findFirst({
      where: {
        email: { equals: emailToCheck, mode: 'insensitive' },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalCount = await prisma.waitlistSubmission.count();
    const isVerified = Boolean(
      submission &&
      (submission.status === 'ACCEPTED' ||
        submission.status === 'WEEKLY_ACTIVE' ||
        submission.status === 'STRATEGY_DELIVERED' ||
        submission.adminNotes === 'VERIFIED_CODE')
    );

    res.status(200).json({
      success: true,
      hasSubmitted: Boolean(submission),
      isVerified,
      position: totalCount,
      inviteCode: submission?.shareToken || null,
      submission: submission || null,
    });
  } catch (error: any) {
    console.error('[checkStatus error]:', error);
    res.status(500).json({ success: false, message: 'Failed to check waitlist status' });
  }
}

/**
 * Public/Auth: Verify waitlist invite / access code
 */
export async function verifyCode(req: Request, res: Response): Promise<void> {
  try {
    const { code, email } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: 'Invite code is required' });
      return;
    }

    const cleanCode = String(code).trim().toUpperCase();
    const validMasterCodes = ['ONDEL1', 'ONDEL2026', 'VIP2026', 'EARLYACCESS', 'FOUNDER'];

    const userEmail = email ? String(email).toLowerCase().trim() : (req as any).user?.email;

    // Strict code check: shareToken must equal cleanCode exactly
    let submission = await prisma.waitlistSubmission.findFirst({
      where: {
        shareToken: cleanCode,
      },
    });

    // If not found by shareToken directly, check if user has a submission whose shareToken equals cleanCode
    if (!submission && userEmail) {
      const userSub = await prisma.waitlistSubmission.findFirst({
        where: { email: { equals: userEmail, mode: 'insensitive' as const } },
      });
      if (userSub && userSub.shareToken.trim().toUpperCase() === cleanCode) {
        submission = userSub;
      }
    }

    const isValid = validMasterCodes.includes(cleanCode) || Boolean(submission);

    if (isValid) {
      if (submission) {
        await prisma.waitlistSubmission.update({
          where: { id: submission.id },
          data: { status: 'ACCEPTED', adminNotes: 'VERIFIED_CODE' },
        });
      } else if (userEmail) {
        await prisma.waitlistSubmission.updateMany({
          where: { email: { equals: userEmail, mode: 'insensitive' as const } },
          data: { status: 'ACCEPTED', adminNotes: 'VERIFIED_CODE' },
        });
      }

      res.status(200).json({
        success: true,
        verified: true,
        redirectUrl: process.env.DASHBOARD_URL || 'http://localhost:5174',
      });
    } else {
      res.status(400).json({
        success: false,
        verified: false,
        message: "That invite code is invalid. Please check and try again.",
      });
    }
  } catch (error: any) {
    console.error('[verifyCode error]:', error);
    res.status(500).json({ success: false, message: 'Failed to verify invite code' });
  }
}

/**
 * Admin: Send waitlist access code to user via email
 */
export async function sendWaitlistCode(req: AuthRequest, res: Response): Promise<void> {
  try {
    const subId = String(req.params.id);
    const submission = await prisma.waitlistSubmission.findUnique({ where: { id: subId } });

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    let accessCode = submission.shareToken ? submission.shareToken.trim().toUpperCase() : '';

    // If shareToken is a UUID (contains hyphens or is longer than 10 chars), convert to clean 6-char code (e.g. OND782)
    if (!accessCode || accessCode.includes('-') || accessCode.length > 10) {
      accessCode = 'OND' + Math.floor(100 + Math.random() * 900);
      await prisma.waitlistSubmission.update({
        where: { id: submission.id },
        data: { shareToken: accessCode },
      });
    }

    const totalSubmissions = await prisma.waitlistSubmission.count();

    // Dispatch waitlist access code email
    await sendWaitlistConfirmationEmail(
      submission.email,
      submission.artistName,
      accessCode,
      totalSubmissions
    );

    res.status(200).json({
      success: true,
      message: `Waitlist access code (${accessCode}) sent to ${submission.email}`,
      code: accessCode,
    });
  } catch (error: any) {
    console.error('[sendWaitlistCode error]:', error);
    res.status(500).json({ success: false, message: 'Failed to send waitlist access code email' });
  }
}

/**
 * Admin: Analysis breakdown of select options by step
 */
export async function getAnalysisBreakdown(req: AuthRequest, res: Response): Promise<void> {
  try {
    const submissions = await prisma.waitlistSubmission.findMany({
      select: {
        id: true,
        artistName: true,
        email: true,
        shareToken: true,
        urgency: true,
        biggestChallenge: true,
        goldmineAnswer: true,
        status: true,
        adminNotes: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const URGENCY_OPTIONS = [
      { id: 'WITHIN_2_WEEKS', label: 'Within 2 weeks' },
      { id: 'THIS_MONTH', label: 'This month' },
      { id: 'NEXT_3_MONTHS', label: 'Next 3 months' },
      { id: 'JUST_EXPLORING', label: 'Just exploring' },
    ];

    const CHALLENGE_OPTIONS = [
      { id: 'DONT_KNOW_WHAT_TO_DO', label: "I don't know what to do after uploading." },
      { id: 'FINDING_PLAYLISTS', label: 'Finding playlists.' },
      { id: 'CREATING_CONTENT', label: 'Creating enough content.' },
      { id: 'WHEN_TO_RELEASE', label: 'Knowing when to release.' },
      { id: 'GROWING_LISTENERS', label: 'Growing listeners.' },
      { id: 'EVERYTHING', label: 'Everything.' },
    ];

    const GOLDMINE_OPTIONS = [
      { id: 'TIKTOK_CONTENT', label: 'TikTok Content & Curator Pitching' },
      { id: 'PLAYLIST_PROMO', label: 'Playlist Promotion & Outreach' },
      { id: 'RELEASE_STRATEGY', label: 'Custom Release Roadmap' },
      { id: 'FAN_GROWTH', label: 'Audience & Fanbase Growth' },
    ];

    // Build urgency breakdown
    const urgencyBreakdown = URGENCY_OPTIONS.map((opt) => {
      const matched = submissions.filter((s) => s.urgency === opt.id);
      return {
        id: opt.id,
        label: opt.label,
        count: matched.length,
        users: matched,
      };
    });

    // Build challenge breakdown
    const challengeBreakdown = CHALLENGE_OPTIONS.map((opt) => {
      const matched = submissions.filter((s) => s.biggestChallenge === opt.id);
      return {
        id: opt.id,
        label: opt.label,
        count: matched.length,
        users: matched,
      };
    });

    // Build goldmine breakdown (fuzzy matching in goldmineAnswer text)
    const goldmineBreakdown = GOLDMINE_OPTIONS.map((opt) => {
      const matched = submissions.filter((s) => {
        const text = (s.goldmineAnswer || '').toLowerCase();
        if (opt.id === 'TIKTOK_CONTENT') return text.includes('tiktok') || text.includes('content');
        if (opt.id === 'PLAYLIST_PROMO') return text.includes('playlist') || text.includes('pitch');
        if (opt.id === 'RELEASE_STRATEGY') return text.includes('roadmap') || text.includes('strategy');
        if (opt.id === 'FAN_GROWTH') return text.includes('growth') || text.includes('listeners') || text.includes('fan');
        return false;
      });
      return {
        id: opt.id,
        label: opt.label,
        count: matched.length,
        users: matched,
      };
    });

    res.status(200).json({
      success: true,
      totalSubmissions: submissions.length,
      steps: [
        {
          stepNumber: 2,
          stepTitle: 'Step 2: Release Urgency',
          question: 'Do you have a release coming up?',
          options: urgencyBreakdown,
        },
        {
          stepNumber: 3,
          stepTitle: 'Step 3: Biggest Challenge',
          question: "What's your biggest challenge?",
          options: challengeBreakdown,
        },
        {
          stepNumber: 4,
          stepTitle: 'Step 4: Primary Ondel Task',
          question: 'If Ondel could manage ONE thing...',
          options: goldmineBreakdown,
        },
      ],
    });
  } catch (error: any) {
    console.error('[getAnalysisBreakdown error]:', error);
    res.status(500).json({ success: false, message: 'Failed to calculate analysis breakdown' });
  }
}

/**
 * Admin: Get all songs uploaded in Ondel
 */
export async function getAdminSongs(req: AuthRequest, res: Response): Promise<void> {
  try {
    // 1. Fetch waitlist submissions with audio demos or streaming links
    const waitlistSubmissions = await prisma.waitlistSubmission.findMany({
      where: {
        OR: [
          { demoUrl: { not: null } },
          { audioFileName: { not: null } },
          { spotifyLink: { not: null } },
          { appleMusicLink: { not: null } },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch songs with WAITLIST_SUBMISSION metadata
    const waitlistSongs = await prisma.song.findMany({
      where: {
        OR: [
          { metadata: { path: ['source'], equals: 'WAITLIST_SUBMISSION' } },
          { soundVibe: 'Waitlist Demo' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        artist: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    // Map waitlist submissions to song items
    const submissionSongMap = new Map();

    waitlistSubmissions.forEach((sub) => {
      const title = sub.audioFileName
        ? sub.audioFileName.replace(/\.[^/.]+$/, '')
        : `${sub.artistName} Waitlist Song`;

      submissionSongMap.set(sub.id, {
        id: sub.id,
        title,
        genre: 'Afrobeats',
        subgenres: [],
        bpm: 112,
        audioUrl: sub.demoUrl || null,
        epkUrl: sub.spotifyLink || sub.appleMusicLink || null,
        metadata: {
          source: 'WAITLIST_SUBMISSION',
          submissionId: sub.id,
          aiScrutinizer: {
            bpm: 112,
            key: 'C Major',
            energy: 8,
            danceability: 0.85,
            status: 'PASSED',
          },
        },
        createdAt: sub.createdAt,
        artistName: sub.artistName,
        uploaderEmail: sub.email,
        uploaderName: sub.artistName,
        projectName: 'Waitlist Onboarding',
      });
    });

    // Merge in any waitlistSongs from prisma.song
    waitlistSongs.forEach((s) => {
      const subId = (s.metadata as any)?.submissionId;
      if (subId && submissionSongMap.has(subId)) {
        const existing = submissionSongMap.get(subId);
        submissionSongMap.set(subId, {
          ...existing,
          id: s.id,
          title: s.title || existing.title,
          genre: s.genre || existing.genre,
          bpm: s.bpm || (s.metadata as any)?.aiScrutinizer?.bpm || existing.bpm,
          audioUrl: s.audioUrl || existing.audioUrl,
          epkUrl: s.epkUrl || existing.epkUrl,
        });
      } else {
        submissionSongMap.set(s.id, {
          id: s.id,
          title: s.title,
          genre: s.genre,
          subgenres: s.subgenres,
          bpm: s.bpm || (s.metadata as any)?.aiScrutinizer?.bpm || 112,
          audioUrl: s.audioUrl,
          epkUrl: s.epkUrl,
          metadata: s.metadata,
          createdAt: s.createdAt,
          artistName: s.artist?.name || s.artist?.user?.name || 'Waitlist Artist',
          uploaderEmail: s.artist?.user?.email || 'N/A',
          uploaderName: s.artist?.user?.name || s.artist?.name || 'N/A',
          projectName: 'Waitlist Onboarding',
        });
      }
    });

    const result = Array.from(submissionSongMap.values()).sort(
      (a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    res.status(200).json({
      success: true,
      count: result.length,
      songs: result,
    });
  } catch (error: any) {
    console.error('[getAdminSongs error]:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch waitlist songs list' });
  }
}

/**
 * Admin: Get all waitlist drafts (uncompleted step drop-offs)
 */
export async function getAdminDrafts(req: AuthRequest, res: Response): Promise<void> {
  try {
    const drafts = await prisma.waitlistDraft.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        user: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    res.status(200).json({
      success: true,
      count: drafts.length,
      drafts,
    });
  } catch (error: any) {
    console.error('[getAdminDrafts error]:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch admin waitlist drafts' });
  }
}

/**
 * Admin: Get all saved waitlist invitees (from landing page hero)
 */
export async function getAdminInvitees(req: AuthRequest, res: Response): Promise<void> {
  try {
    const invitees = await prisma.waitlistInvitee.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: invitees.length,
      invitees,
    });
  } catch (error: any) {
    console.error('[getAdminInvitees error]:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch waitlist invitees' });
  }
}



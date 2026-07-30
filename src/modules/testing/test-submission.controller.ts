import { Request, Response } from 'express';
import { prisma } from '../../config/prisma';

export class TestSubmissionController {
  static async create(req: Request, res: Response): Promise<void> {
    try {
      const { artistName, songTitle, spotifyUrl, email, pitchMessage, epkUrl, sourceUrl } = req.body;

      if (!artistName || !songTitle || !email) {
        res.status(400).json({ error: 'artistName, songTitle, and email are required.' });
        return;
      }

      const submission = await prisma.testSubmission.create({
        data: {
          artistName: String(artistName),
          songTitle: String(songTitle),
          spotifyUrl: spotifyUrl ? String(spotifyUrl) : null,
          email: String(email),
          pitchMessage: pitchMessage ? String(pitchMessage) : null,
          epkUrl: epkUrl ? String(epkUrl) : null,
          sourceUrl: sourceUrl ? String(sourceUrl) : null,
        },
      });

      console.log(`✅ [TestSubmission] Live Form Submission Received! ID: ${submission.id} for "${submission.artistName} - ${submission.songTitle}"`);

      res.status(201).json({
        success: true,
        submissionId: submission.id,
        message: 'Submission Received Successfully! Thank you.',
        submission,
      });
    } catch (err: any) {
      console.error('❌ [TestSubmission Error]:', err.message);
      res.status(500).json({ error: 'Failed to record test submission.' });
    }
  }

  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const submissions = await prisma.testSubmission.findMany({
        orderBy: { createdAt: 'desc' },
      });
      res.json({ data: submissions });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}

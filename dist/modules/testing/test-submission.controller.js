"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestSubmissionController = void 0;
const prisma_1 = require("../../config/prisma");
class TestSubmissionController {
    static async create(req, res) {
        try {
            const { artistName, songTitle, spotifyUrl, email, pitchMessage, epkUrl, sourceUrl } = req.body;
            if (!artistName || !songTitle || !email) {
                res.status(400).json({ error: 'artistName, songTitle, and email are required.' });
                return;
            }
            const submission = await prisma_1.prisma.testSubmission.create({
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
        }
        catch (err) {
            console.error('❌ [TestSubmission Error]:', err.message);
            res.status(500).json({ error: 'Failed to record test submission.' });
        }
    }
    static async list(_req, res) {
        try {
            const submissions = await prisma_1.prisma.testSubmission.findMany({
                orderBy: { createdAt: 'desc' },
            });
            res.json({ data: submissions });
        }
        catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
}
exports.TestSubmissionController = TestSubmissionController;

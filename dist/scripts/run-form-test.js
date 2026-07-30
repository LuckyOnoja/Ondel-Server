"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const form_automation_service_1 = require("../modules/outreach/form-automation.service");
const prisma_1 = require("../config/prisma");
async function main() {
    const targetFormUrl = process.env.TEST_FORM_URL || 'http://localhost:19006/test-form';
    console.log(`============== STARTING END-TO-END AUTOMATED FORM SUBMISSION TEST ==============`);
    console.log(`[Form Target]: ${targetFormUrl}`);
    const testPayload = {
        artistName: 'Shallipoppi (Test)',
        songTitle: 'Cast (Remix)',
        genre: 'Afrobeats',
        spotifyUrl: 'https://open.spotify.com/track/4ocdD0Bi1syVqLs1GiHqQ9',
        audioUrl: 'https://example.com/audio.mp3',
        epkUrl: 'https://ondel.io/epk/shallipoppi-cast',
        email: 'test-artist@ondel.io',
        pitchMessage: 'Hey team, here is the new Afrobeats single "Cast (Remix)" for playlist consideration. Similar to Shallipoppi & Burna Boy vibes.',
    };
    console.log('\n[Step 1] Executing FormAutomationService (Crawling form -> AI field mapping -> Submitting form payload)...');
    const result = await form_automation_service_1.FormAutomationService.submitForm(targetFormUrl, testPayload);
    console.log('\n[Step 2] Submission Execution Result:');
    console.log(`Success: ${result.success}`);
    console.log(`Cloudinary Proof URL: ${result.proofUrl || 'Generated html confirmation'}`);
    console.log(`Message: ${result.message}`);
    // Fetch the latest record from test_submissions table in PostgreSQL
    console.log('\n[Step 3] Querying Render PostgreSQL Database ("test_submissions" table)...');
    const latestSubmissions = await prisma_1.prisma.testSubmission.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
    });
    console.log('\n============== LATEST FORM SUBMISSIONS IN POSTGRESQL ==============');
    console.dir(latestSubmissions, { depth: null });
    await prisma_1.prisma.$disconnect();
}
main().catch((err) => {
    console.error('Fatal Form Test Error:', err);
    process.exit(1);
});

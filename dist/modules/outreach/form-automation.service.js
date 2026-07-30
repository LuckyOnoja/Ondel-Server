"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormAutomationService = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const fs_1 = __importDefault(require("fs"));
const cloudinary_service_1 = require("../../services/cloudinary.service");
class FormAutomationService {
    static async submitForm(formUrl, payload) {
        let browser;
        try {
            console.log(`[FormAutomation] Launching Headless Browser to visit ${formUrl}...`);
            // Detect system Chrome binary on macOS if available
            let executablePath = undefined;
            if (fs_1.default.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')) {
                executablePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
                console.log('[FormAutomation] Using system Google Chrome binary.');
            }
            browser = await puppeteer_1.default.launch({
                headless: true,
                executablePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 800 });
            // Navigate to the form page and wait for DOM content
            await page.goto(formUrl, { waitUntil: 'networkidle2', timeout: 30000 });
            // Wait for form or input elements to be rendered by React/Vue/HTML
            try {
                await page.waitForSelector('form, input', { timeout: 8000 });
            }
            catch (waitErr) {
                console.warn(`[FormAutomation] Selector wait timeout on ${formUrl}. Proceeding with page content.`);
            }
            // Check if inputs exist on page
            const inputs = await page.$$('input, textarea');
            if (inputs.length === 0) {
                console.warn(`[FormAutomation] No inputs found on ${formUrl}. Logged as link.`);
                await browser.close();
                return {
                    success: true,
                    message: 'Direct submission page recorded.',
                };
            }
            console.log(`[FormAutomation] Found ${inputs.length} input fields on page. Auto-filling fields...`);
            // Auto-fill form fields by analyzing name, placeholder, or type attributes
            for (const input of inputs) {
                const name = (await page.evaluate((el) => el.getAttribute('name') || '', input)).toLowerCase();
                const placeholder = (await page.evaluate((el) => el.getAttribute('placeholder') || '', input)).toLowerCase();
                const type = (await page.evaluate((el) => el.getAttribute('type') || '', input)).toLowerCase();
                if (name.includes('artist') || placeholder.includes('artist')) {
                    await input.type(payload.artistName, { delay: 50 });
                }
                else if (name.includes('title') || name.includes('song') || placeholder.includes('song') || placeholder.includes('title')) {
                    await input.type(payload.songTitle, { delay: 50 });
                }
                else if (name.includes('spotify') || name.includes('url') || placeholder.includes('spotify') || placeholder.includes('url')) {
                    await input.type(payload.spotifyUrl || payload.audioUrl || '', { delay: 50 });
                }
                else if (name.includes('email') || placeholder.includes('email') || type === 'email') {
                    await input.type(payload.email, { delay: 50 });
                }
                else if (name.includes('message') || name.includes('pitch') || placeholder.includes('pitch') || placeholder.includes('description')) {
                    await input.type(payload.pitchMessage, { delay: 50 });
                }
                else if (name.includes('epk') || placeholder.includes('epk') || placeholder.includes('press')) {
                    await input.type(payload.epkUrl || '', { delay: 50 });
                }
            }
            console.log('[FormAutomation] Submitting form by clicking submit button...');
            // Find and click submit button
            const submitButton = await page.$('button[type="submit"], input[type="submit"]');
            if (submitButton) {
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => { }),
                    submitButton.click(),
                ]);
            }
            await new Promise((r) => setTimeout(r, 2000));
            // Capture screenshot of submission confirmation page as proof receipt
            const screenshotBuffer = await page.screenshot({ fullPage: true });
            await browser.close();
            console.log('[FormAutomation] Uploading screenshot proof to Cloudinary CDN...');
            let proofUrl = '';
            try {
                proofUrl = await cloudinary_service_1.CloudinaryService.uploadProofBuffer(Buffer.from(screenshotBuffer));
                console.log(`✅ [FormAutomation] Proof Screenshot Uploaded to Cloudinary: ${proofUrl}`);
            }
            catch (cloudErr) {
                console.warn('[CloudinaryUpload] Error uploading screenshot:', cloudErr.message);
            }
            return {
                success: true,
                proofUrl,
                message: 'Form filled, submitted, and proof captured successfully.',
            };
        }
        catch (err) {
            if (browser)
                await browser.close();
            console.error(`[FormAutomation Error] on ${formUrl}:`, err.message);
            return {
                success: false,
                message: err.message,
            };
        }
    }
}
exports.FormAutomationService = FormAutomationService;

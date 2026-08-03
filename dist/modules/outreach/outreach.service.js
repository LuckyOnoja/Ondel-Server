"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutreachService = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_1 = require("../../config/env");
const deepseek_gemini_provider_1 = require("../../providers/ai/deepseek-gemini.provider");
class OutreachService {
    static transporter = nodemailer_1.default.createTransport({
        host: env_1.env.SMTP_HOST,
        port: env_1.env.SMTP_PORT,
        secure: env_1.env.SMTP_PORT === 465, // true for port 465, false for 587
        auth: {
            user: env_1.env.SMTP_USER,
            pass: env_1.env.SMTP_PASS,
        },
    });
    static aiProvider = new deepseek_gemini_provider_1.DeepSeekGeminiAIProvider();
    static async sendPersonalizedPitch(input) {
        const { targetId, recipientEmail, recipientName, organization, artistName, songTitle, genre, epkUrl, audioUrl } = input;
        // Generate personalized pitch email via DeepSeek / Gemini
        const pitchBody = await this.generatePitchContent({
            recipientName: recipientName || 'Music Curator',
            organization: organization || 'Playlist / Radio Team',
            artistName,
            songTitle,
            genre,
            epkUrl: epkUrl || 'https://ondel.io',
            audioUrl: audioUrl || 'https://ondel.io',
        });
        const trackingFooter = `<br><br><span style="display:none;color:transparent;font-size:0px;">Ref: ONDEL-TGT-${targetId}</span>`;
        const fullHtml = `${pitchBody}${trackingFooter}`;
        const fromAddress = `"${env_1.env.SMTP_FROM_NAME}" <${env_1.env.SMTP_USER}>`;
        const replyToAddress = env_1.env.SMTP_USER; // Valid direct email address so curator replies deliver cleanly without bouncing
        try {
            await this.transporter.sendMail({
                from: fromAddress,
                to: recipientEmail,
                replyTo: replyToAddress,
                subject: `Music Submission: "${songTitle}" by ${artistName} (${genre})`,
                html: fullHtml,
                headers: {
                    'X-Ondel-Target-ID': targetId,
                },
            });
            console.log(`[OutreachService] Successfully sent pitch email to ${recipientEmail} (Target ID: ${targetId})`);
            return true;
        }
        catch (error) {
            console.error(`[OutreachService] Failed to send email to ${recipientEmail}:`, error.message);
            return false;
        }
    }
    static async generatePitchContent(params) {
        // Fallback template if LLM is unavailable
        const fallbackTemplate = `
      <p>Hi ${params.recipientName},</p>
      <p>Hope you are having a great week!</p>
      <p>I am reaching out regarding a new ${params.genre} release titled <strong>"${params.songTitle}"</strong> by <strong>${params.artistName}</strong> that we believe would be a fantastic fit for ${params.organization}.</p>
      <p>You can listen to the track and view the press kit here: <a href="${params.audioUrl}">${params.audioUrl}</a></p>
      <p>We would love for you to consider it for your playlist/station rotation. Looking forward to hearing your thoughts!</p>
      <p>Best regards,<br>${params.artistName} Team</p>
    `;
        return fallbackTemplate;
    }
}
exports.OutreachService = OutreachService;

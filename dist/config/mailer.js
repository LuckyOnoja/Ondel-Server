"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = sendOtpEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_js_1 = require("./env.js");
const transporter = nodemailer_1.default.createTransport({
    service: 'gmail',
    auth: {
        user: env_js_1.env.EMAIL_USER,
        pass: env_js_1.env.EMAIL_PASSWORD,
    },
});
async function sendOtpEmail(toEmail, otp) {
    const isConfigured = Boolean(env_js_1.env.EMAIL_USER && env_js_1.env.EMAIL_PASSWORD);
    if (!isConfigured) {
        console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] OTP for ${toEmail}: ${otp}
  (Add real EMAIL_PASSWORD to .env to deliver real emails)
  =============================================================
    `);
        return true;
    }
    try {
        await transporter.sendMail({
            from: `"Ondel Music" <${env_js_1.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Your Ondel Verification Code: ${otp}`,
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #0c0d0e; color: #f4f4f5; border-radius: 16px;">
          <h2 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Welcome to Ondel</h2>
          <p style="color: #a1a1aa; font-size: 15px; margin-bottom: 24px;">Use the verification code below to complete your authentication. This code will expire in 10 minutes.</p>
          <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 6px; color: #3b82f6;">${otp}</span>
          </div>
          <p style="color: #71717a; font-size: 13px;">If you did not request this email, please ignore it.</p>
        </div>
      `,
        });
        console.log(`✅ [Mailer] Sent OTP email successfully to ${toEmail}`);
        return true;
    }
    catch (error) {
        console.error(`❌ [Mailer Error] Failed to send email to ${toEmail}:`, error);
        // Fallback log in dev
        console.log(`🔑 Fallback OTP for ${toEmail}: ${otp}`);
        return false;
    }
}

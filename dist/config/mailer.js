"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpEmail = sendOtpEmail;
exports.sendWaitlistConfirmationEmail = sendWaitlistConfirmationEmail;
exports.sendStrategyDeliveredEmail = sendStrategyDeliveredEmail;
exports.sendWeeklyOpportunityEmail = sendWeeklyOpportunityEmail;
const nodemailer_1 = __importDefault(require("nodemailer"));
const env_js_1 = require("./env.js");
const email_template_js_1 = require("../utils/email-template.js");
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
    const html = (0, email_template_js_1.buildOndelEmailTemplate)({
        badgeText: 'SECURITY VERIFICATION',
        title: 'Verification Code',
        bodyHtml: `
      <p style="margin: 0 0 16px 0;">Use the 6-digit verification code below to authenticate into your Ondel workspace. This code will expire in 10 minutes.</p>
      <div style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 6px; padding: 24px; text-align: center; margin: 24px 0;" class="email-badge">
        <span style="font-size: 38px; font-weight: 800; letter-spacing: 10px; font-family: monospace;" class="email-brand-text">${otp}</span>
      </div>
      <p style="margin: 0; font-size: 13px;" class="email-muted">If you did not request this verification code, please ignore this message.</p>
    `,
    });
    try {
        await transporter.sendMail({
            from: `"Ondel Music" <${env_js_1.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Your Ondel Verification Code: ${otp}`,
            html,
        });
        console.log(`✅ [Mailer] Sent OTP email successfully to ${toEmail}`);
        return true;
    }
    catch (error) {
        console.error(`❌ [Mailer Error] Failed to send email to ${toEmail}:`, error);
        console.log(`🔑 Fallback OTP for ${toEmail}: ${otp}`);
        return false;
    }
}
async function sendWaitlistConfirmationEmail(toEmail, artistName) {
    const isConfigured = Boolean(env_js_1.env.EMAIL_USER && env_js_1.env.EMAIL_PASSWORD);
    if (!isConfigured) {
        console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] Waitlist Confirmation for ${artistName} (${toEmail}):
  "You're on the Ondel Waitlist! We are reviewing your release strategy."
  =============================================================
    `);
        return true;
    }
    const html = (0, email_template_js_1.buildOndelEmailTemplate)({
        badgeText: 'SUBMISSION CONFIRMED',
        title: `Welcome to Ondel, ${artistName}`,
        bodyHtml: `
      <p style="margin: 0 0 16px 0;">We received your music submission and release details. Ondel AI is building your custom 5-pillar launch strategy:</p>
      <ul style="line-height: 1.9; padding-left: 20px; margin: 0 0 20px 0;">
        <li>Personalised Release Roadmap</li>
        <li>30-Day Content Calendar</li>
        <li>Playlist Pitching Targets</li>
        <li>Creator Opportunities</li>
        <li>Execution Checklist</li>
      </ul>
      <p style="margin: 0;">You will receive an email as soon as your strategy workspace is generated.</p>
    `,
    });
    try {
        await transporter.sendMail({
            from: `"Ondel Team" <${env_js_1.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `You're on the Ondel Waitlist, ${artistName}!`,
            html,
        });
        console.log(`✅ [Mailer] Sent Waitlist Confirmation email successfully to ${toEmail}`);
        return true;
    }
    catch (error) {
        console.error(`❌ [Mailer Error] Failed to send waitlist confirmation email to ${toEmail}:`, error);
        return false;
    }
}
async function sendStrategyDeliveredEmail(toEmail, artistName, shareToken) {
    const isConfigured = Boolean(env_js_1.env.EMAIL_USER && env_js_1.env.EMAIL_PASSWORD);
    const strategyUrl = `${process.env.APP_URL || 'http://localhost:8000'}/strategy/${shareToken}`;
    if (!isConfigured) {
        console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] Strategy Delivered to ${artistName} (${toEmail}):
  Link: ${strategyUrl}
  =============================================================
    `);
        return true;
    }
    const html = (0, email_template_js_1.buildOndelEmailTemplate)({
        badgeText: 'STRATEGY READY',
        title: `Release Strategy Ready for ${artistName}`,
        bodyHtml: `
      <p style="margin: 0 0 16px 0;">Ondel AI has completed analyzing your release details and built your custom 5-pillar launch plan.</p>
      <p style="margin: 0;">Access your strategy roadmap, content calendar, playlist targets, and weekly checklist inside your release workspace.</p>
    `,
        ctaText: 'Access Your Release Strategy',
        ctaUrl: strategyUrl,
    });
    try {
        await transporter.sendMail({
            from: `"Ondie AI Manager" <${env_js_1.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Your Ondel Personalised Release Strategy is Ready`,
            html,
        });
        console.log(`✅ [Mailer] Sent Strategy Delivered email successfully to ${toEmail}`);
        return true;
    }
    catch (error) {
        console.error(`❌ [Mailer Error] Failed to send strategy email to ${toEmail}:`, error);
        return false;
    }
}
async function sendWeeklyOpportunityEmail(toEmail, artistName, updateTitle, shareToken) {
    const isConfigured = Boolean(env_js_1.env.EMAIL_USER && env_js_1.env.EMAIL_PASSWORD);
    const strategyUrl = `${process.env.APP_URL || 'http://localhost:8000'}/strategy/${shareToken}`;
    if (!isConfigured) {
        console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] Weekly Opportunity Alert for ${artistName} (${toEmail}):
  Title: ${updateTitle}
  Link: ${strategyUrl}
  =============================================================
    `);
        return true;
    }
    const html = (0, email_template_js_1.buildOndelEmailTemplate)({
        badgeText: 'WEEKLY OPPORTUNITIES',
        title: `New Opportunities for ${artistName}`,
        bodyHtml: `
      <p style="margin: 0 0 12px 0; font-weight: 700;">${updateTitle}</p>
      <p style="margin: 0;">New playlist pitching targets and creator collaboration concepts have been added to your release workspace.</p>
    `,
        ctaText: 'View New Opportunities',
        ctaUrl: strategyUrl,
    });
    try {
        await transporter.sendMail({
            from: `"Ondie AI Manager" <${env_js_1.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `Ondel Update: ${updateTitle}`,
            html,
        });
        console.log(`✅ [Mailer] Sent Weekly Opportunity email to ${toEmail}`);
        return true;
    }
    catch (error) {
        console.error(`❌ [Mailer Error] Failed to send weekly opportunity email to ${toEmail}:`, error);
        return false;
    }
}

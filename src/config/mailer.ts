import nodemailer from 'nodemailer';
import { env } from './env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASSWORD,
  },
});

export async function sendOtpEmail(toEmail: string, otp: string): Promise<boolean> {
  const isConfigured = Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);

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
      from: `"Ondel Music" <${env.EMAIL_USER}>`,
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
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send email to ${toEmail}:`, error);
    // Fallback log in dev
    console.log(`🔑 Fallback OTP for ${toEmail}: ${otp}`);
    return false;
  }
}

export async function sendWaitlistConfirmationEmail(toEmail: string, artistName: string): Promise<boolean> {
  const isConfigured = Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);

  if (!isConfigured) {
    console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] Waitlist Confirmation for ${artistName} (${toEmail}):
  "You're on the Ondel Waitlist! We are reviewing your release strategy."
  =============================================================
    `);
    return true;
  }

  try {
    await transporter.sendMail({
      from: `"Ondel Team" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `You're on the Ondel Waitlist, ${artistName}! 🎵`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px; background: #0c0d0e; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 700; color: #10b981; text-transform: uppercase; letter-spacing: 1px;">Submission Confirmed</span>
          </div>
          <h2 style="font-size: 24px; font-weight: 800; margin-bottom: 12px; color: #ffffff;">Welcome to the Ondel Waitlist, ${artistName}!</h2>
          <p style="color: #a1a1aa; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
            We received your release details and audio submission. Our team and Ondie AI are reviewing your submission and building your 5-pillar launch strategy:
          </p>
          <ul style="color: #d4d4d8; font-size: 14px; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
            <li>🎯 Personalised Release Roadmap</li>
            <li>📅 30-Day Content Calendar</li>
            <li>🎧 Playlist Pitching Targets</li>
            <li>🤝 Creator Opportunities</li>
            <li>✅ Execution Checklist</li>
          </ul>
          <p style="color: #71717a; font-size: 13px; line-height: 1.5;">
            You will receive a notification email as soon as your strategy workspace is ready.
          </p>
        </div>
      `,
    });
    console.log(`✅ [Mailer] Sent Waitlist Confirmation email successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send waitlist confirmation email to ${toEmail}:`, error);
    return false;
  }
}

export async function sendStrategyDeliveredEmail(toEmail: string, artistName: string, shareToken: string): Promise<boolean> {
  const isConfigured = Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);
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

  try {
    await transporter.sendMail({
      from: `"Ondie AI Manager" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Ondel Personalised Release Strategy is Ready 🚀`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px; background: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1px;">Ondie AI Release Manager</span>
          </div>
          <h2 style="font-size: 26px; font-weight: 800; margin-bottom: 12px; color: #ffffff;">Your Personalised Strategy for ${artistName}</h2>
          <p style="color: #a1a1aa; font-size: 15px; leading-height: 1.6; margin-bottom: 24px;">
            We have reviewed your release details and built your custom 5-pillar launch plan (Release Roadmap, 30-Day Content Calendar, Playlist Pitching Targets, Creator Opportunities, and Checklist).
          </p>
          <div style="text-align: center; margin-bottom: 28px;">
            <a href="${strategyUrl}" style="display: inline-block; background: linear-gradient(to right, #f59e0b, #d97706); color: #09090b; font-weight: 700; font-size: 15px; padding: 14px 28px; border-radius: 12px; text-decoration: none; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);">
              View Your Personalised Strategy →
            </a>
          </div>
          <p style="color: #71717a; font-size: 13px; line-height: 1.5;">
            We will continue to analyze your release performance and send you new opportunities week after week.
          </p>
        </div>
      `,
    });
    console.log(`✅ [Mailer] Sent Strategy Delivered email successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send strategy email to ${toEmail}:`, error);
    return false;
  }
}

export async function sendWeeklyOpportunityEmail(toEmail: string, artistName: string, updateTitle: string, shareToken: string): Promise<boolean> {
  const isConfigured = Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);
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

  try {
    await transporter.sendMail({
      from: `"Ondie AI Manager" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Ondie Update: ${updateTitle}`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; padding: 32px; background: #09090b; color: #f4f4f5; border-radius: 16px; border: 1px solid #27272a;">
          <div style="margin-bottom: 20px;">
            <span style="font-size: 12px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 1px;">Weekly Opportunity Update</span>
          </div>
          <h2 style="font-size: 22px; font-weight: 800; margin-bottom: 12px; color: #ffffff;">Ondie found new opportunities for your release</h2>
          <p style="color: #e4e4e7; font-size: 15px; font-weight: 600; margin-bottom: 16px;">
            ${updateTitle}
          </p>
          <p style="color: #a1a1aa; font-size: 14px; margin-bottom: 24px;">
            New playlist pitching targets and viral content concepts have been added directly to your release workspace.
          </p>
          <div style="text-align: center; margin-bottom: 24px;">
            <a href="${strategyUrl}" style="display: inline-block; background: #a855f7; color: #ffffff; font-weight: 700; font-size: 14px; padding: 12px 24px; border-radius: 10px; text-decoration: none;">
              Open Release Workspace →
            </a>
          </div>
        </div>
      `,
    });
    console.log(`✅ [Mailer] Sent Weekly Opportunity email to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send weekly opportunity email to ${toEmail}:`, error);
    return false;
  }
}

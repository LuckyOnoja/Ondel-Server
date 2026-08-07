import nodemailer from 'nodemailer';
import { env } from './env.js';
import { buildOndelEmailTemplate } from '../utils/email-template.js';

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

  const formattedOtp = otp.split('').join(' ');

  const html = buildOndelEmailTemplate({
    title: 'Verify Your Email',
    subtitle: 'Registration Verification Code',
    bodyHtml: `
      <p style="margin: 0 0 20px 0; font-size: 15px; line-height: 1.6; color: #27272a;">
        Thank you for registering on <strong>Ondel</strong>. Please enter the 6-digit verification code below to verify your email address and activate your account:
      </p>
      
      <div class="email-otp-box" style="background-color: #f4f4f5; border: 1px solid #e4e4e7; border-radius: 8px; padding: 24px 16px; text-align: center; margin: 24px 0; overflow-x: auto;">
        <span class="email-otp-text" style="font-size: 28px; font-weight: 800; letter-spacing: 6px; font-family: 'SF Mono', Consolas, Monaco, monospace; color: #09090b; display: inline-block; white-space: nowrap;">${formattedOtp}</span>
      </div>

      <p class="email-muted" style="margin: 0; font-size: 13px; line-height: 1.5; color: #71717a;">
        This verification code will expire in 10 minutes. If you did not attempt to register on Ondel, please disregard this message.
      </p>
    `,
  });

  try {
    await transporter.sendMail({
      from: `"Ondel Music" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Ondel Verification Code: ${otp}`,
      html,
    });
    console.log(`✅ [Mailer] Sent OTP email successfully to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send email to ${toEmail}:`, error);
    console.log(`🔑 Fallback OTP for ${toEmail}: ${otp}`);
    return false;
  }
}

export async function sendWaitlistConfirmationEmail(
  toEmail: string,
  artistName: string,
  inviteCode?: string,
  position?: number
): Promise<boolean> {
  const isConfigured = Boolean(env.EMAIL_USER && env.EMAIL_PASSWORD);
  const codeStr = inviteCode || 'OND2026';
  const posStr = position ? `#${position}` : '';

  if (!isConfigured) {
    console.log(`
  =============================================================
  📬 [DEVELOPMENT MAIL] Waitlist Confirmation for ${artistName} (${toEmail}):
  Position: ${posStr} | Unique Invite Code: ${codeStr}
  =============================================================
    `);
    return true;
  }

  const html = buildOndelEmailTemplate({
    badgeText: 'WAITLIST ACCESS CODE',
    title: `Welcome to Ondel, ${artistName}!`,
    bodyHtml: `
      <p style="margin: 0 0 16px 0;">Thank you for submitting your release details to Ondel. Your spot in line is <strong>${posStr || 'confirmed'}</strong>.</p>
      
      <div style="background-color: #f4f4f5; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0;">
        <p style="margin: 0 0 8px 0; font-size: 13px; color: #71717a; text-transform: uppercase; letter-spacing: 0.05em;">Your Unique Access Code</p>
        <p style="margin: 0; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 4px; color: #18181b;">${codeStr}</p>
      </div>

      <p style="margin: 0 0 16px 0;">Enter this 6-digit access code on your waitlist confirmation page to unlock instant access to your release dashboard:</p>
      <ul style="line-height: 1.9; padding-left: 20px; margin: 0 0 20px 0;">
        <li>Personalised Release Roadmap</li>
        <li>30-Day Content Calendar</li>
        <li>Playlist Pitching Targets</li>
        <li>Creator Opportunities</li>
      </ul>
    `,
  });

  try {
    await transporter.sendMail({
      from: `"Ondel Team" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Ondel Access Code: ${codeStr} ${posStr}`,
      html,
    });
    console.log(`✅ [Mailer] Sent Waitlist Access Code email (${codeStr}) successfully to ${toEmail}`);
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

  const html = buildOndelEmailTemplate({
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
      from: `"Ondie AI Manager" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Your Ondel Personalised Release Strategy is Ready`,
      html,
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

  const html = buildOndelEmailTemplate({
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
      from: `"Ondie AI Manager" <${env.EMAIL_USER}>`,
      to: toEmail,
      subject: `Ondel Update: ${updateTitle}`,
      html,
    });
    console.log(`✅ [Mailer] Sent Weekly Opportunity email to ${toEmail}`);
    return true;
  } catch (error) {
    console.error(`❌ [Mailer Error] Failed to send weekly opportunity email to ${toEmail}:`, error);
    return false;
  }
}

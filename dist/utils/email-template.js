"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildOndelEmailTemplate = buildOndelEmailTemplate;
/**
 * Builds Ondel's Master Email Template
 *
 * Features:
 * - 100% Inlined styles for first-time senders (Gmail, Outlook, iOS Mail)
 * - Base64 Data URI PNG logo (Renders instantly without waiting for "Show images")
 * - Single-line responsive OTP digits
 * - Universal Light & Dark mode media queries
 */
function buildOndelEmailTemplate(options) {
    const { badgeText, subtitle, title, bodyHtml, ctaText, ctaUrl, footerText = 'If you did not request this email, please disregard this message.', } = options;
    // Hosted Cloudinary CDN PNG logo URL for 100% reliable rendering across all email clients
    const logoUrl = 'https://res.cloudinary.com/dd36lgq0r/image/upload/f_png,w_256,h_256/v1786079641/ondel_logo_mark_v2.png';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${title}</title>
  <style>
    :root {
      color-scheme: light dark;
      supported-color-schemes: light dark;
    }
    body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      background-color: #f4f4f5;
      color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      background-color: #f4f4f5 !important;
      padding: 32px 12px;
    }
    .email-card {
      background-color: #ffffff !important;
      border: 1px solid #e4e4e7 !important;
      border-radius: 8px !important;
      max-width: 520px !important;
      margin: 0 auto !important;
      overflow: hidden !important;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05) !important;
    }
    .email-top-accent {
      height: 4px !important;
      background-color: #09090b !important;
    }
    .email-header {
      padding: 36px 36px 20px 36px;
    }
    .email-brand-text {
      color: #09090b !important;
    }
    .email-body {
      padding: 0 36px 36px 36px;
      color: #09090b !important;
    }
    .email-title {
      color: #09090b !important;
    }
    .email-subtitle {
      color: #71717a !important;
    }
    .email-text {
      color: #27272a !important;
    }
    .email-muted {
      color: #71717a !important;
    }
    .email-otp-box {
      background-color: #f4f4f5 !important;
      border: 1px solid #e4e4e7 !important;
    }
    .email-otp-text {
      color: #09090b !important;
    }
    .email-divider {
      border-bottom: 1px solid #e4e4e7 !important;
    }
    .email-button {
      background-color: #09090b !important;
      color: #ffffff !important;
      border-radius: 6px !important;
    }

    /* Dark Mode Overrides for iOS Mail, Apple Mail, Outlook */
    @media (prefers-color-scheme: dark) {
      body, .email-wrapper {
        background-color: #09090b !important;
        color: #f4f4f5 !important;
      }
      .email-card {
        background-color: #121215 !important;
        border-color: #27272a !important;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4) !important;
      }
      .email-top-accent {
        background-color: #ffffff !important;
      }
      .email-brand-text {
        color: #ffffff !important;
      }
      .email-body {
        color: #f4f4f5 !important;
      }
      .email-title {
        color: #ffffff !important;
      }
      .email-subtitle {
        color: #a1a1aa !important;
      }
      .email-text {
        color: #e4e4e7 !important;
      }
      .email-muted {
        color: #71717a !important;
      }
      .email-otp-box {
        background-color: #18181b !important;
        border-color: #27272a !important;
      }
      .email-otp-text {
        color: #ffffff !important;
      }
      .email-divider {
        border-bottom-color: #27272a !important;
      }
      .email-button {
        background-color: #ffffff !important;
        color: #09090b !important;
      }
    }

    /* Outlook / Samsung Dark Mode Fallback */
    [data-ogsc] .email-wrapper { background-color: #09090b !important; }
    [data-ogsc] .email-card { background-color: #121215 !important; border-color: #27272a !important; }
    [data-ogsc] .email-top-accent { background-color: #ffffff !important; }
    [data-ogsc] .email-brand-text { color: #ffffff !important; }
    [data-ogsc] .email-title { color: #ffffff !important; }
    [data-ogsc] .email-otp-box { background-color: #18181b !important; border-color: #27272a !important; }
    [data-ogsc] .email-otp-text { color: #ffffff !important; }
  </style>
</head>
<body>
  <div class="email-wrapper" style="background-color: #f4f4f5; padding: 32px 12px;">
    <div class="email-card" style="background-color: #ffffff; border: 1px solid #e4e4e7; border-radius: 8px; max-width: 520px; margin: 0 auto; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.05);">
      
      <!-- Top Accent Bar (Inlined) -->
      <div class="email-top-accent" style="height: 4px; background-color: #09090b; width: 100%;"></div>

      <!-- Header with Inlined Base64 PNG Logo Image -->
      <div class="email-header" style="padding: 36px 36px 20px 36px;">
        <table border="0" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
          <tr>
            <td style="padding-right: 12px; vertical-align: middle; border: 0 !important; outline: none !important;">
              <img src="${logoUrl}" width="34" height="34" alt="Ondel" style="display: block; width: 34px; height: 34px; border: 0 !important; border-style: none !important; outline: none !important; text-decoration: none !important; box-shadow: none !important; background: transparent !important;" />
            </td>
            <td style="vertical-align: middle;">
              <span class="email-brand-text" style="font-size: 24px; font-weight: 800; letter-spacing: -0.03em; color: #09090b; font-family: -apple-system, BlinkMacSystemFont, sans-serif;">Ondel</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Body Content -->
      <div class="email-body" style="padding: 0 36px 36px 36px; color: #09090b;">
        
        <!-- Main Title -->
        <h1 class="email-title" style="font-size: 26px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 4px 0; line-height: 1.25; color: #09090b;">
          ${title}
        </h1>

        <!-- Subtitle (Optional) -->
        ${subtitle
        ? `
        <p class="email-subtitle" style="font-size: 14px; font-weight: 500; margin: 0 0 24px 0; color: #71717a;">
          ${subtitle}
        </p>
        `
        : '<div style="height: 20px;"></div>'}

        <!-- Text Content / Code Box -->
        <div class="email-text" style="font-size: 15px; line-height: 1.65; margin-bottom: 28px; color: #27272a;">
          ${bodyHtml}
        </div>

        <!-- Optional Call To Action Button -->
        ${ctaText && ctaUrl
        ? `
        <div style="margin: 28px 0 32px 0;">
          <a href="${ctaUrl}" class="email-button" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: -0.01em; background-color: #09090b; color: #ffffff; border-radius: 6px;">
            ${ctaText} →
          </a>
        </div>
        `
        : ''}

        <!-- Footer Sign-off -->
        <div class="email-divider" style="padding-top: 24px; margin-top: 32px; border-top: 1px solid #e4e4e7;">
          <p class="email-text" style="font-size: 14px; margin: 0 0 4px 0; color: #27272a;">
            Thanks,
          </p>
          <p class="email-title" style="font-size: 14px; font-weight: 700; margin: 0 0 16px 0; color: #09090b;">
            The Ondel Team
          </p>
          <p class="email-muted" style="font-size: 12px; margin: 0; line-height: 1.5; color: #71717a;">
            ${footerText}
          </p>
        </div>

      </div>

    </div>
  </div>
</body>
</html>`;
}

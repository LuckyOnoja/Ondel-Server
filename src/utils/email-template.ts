export interface OndelEmailOptions {
  badgeText?: string;
  title: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerText?: string;
}

/**
 * Builds Ondel's Master Email Template
 * 
 * Features:
 * - Wide-body architectural layout (600px max-width)
 * - Automatic Light & Dark mode support via CSS color-scheme
 * - Official Ondel SVG Logo & brand typography
 * - Crisp, non-rounded editorial aesthetics (4px radius, 1px hair borders)
 */
export function buildOndelEmailTemplate(options: OndelEmailOptions): string {
  const {
    badgeText = 'OFFICIAL NOTICE',
    title,
    bodyHtml,
    ctaText,
    ctaUrl,
    footerText = 'If you did not request this communication, you can safely disregard it.',
  } = options;

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
      background-color: #ffffff;
      color: #09090b;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .email-wrapper {
      background-color: #ffffff;
      padding: 40px 16px;
    }
    .email-card {
      background-color: #ffffff;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 44px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
    }
    .email-brand-text {
      color: #09090b;
    }
    .email-title {
      color: #09090b;
    }
    .email-text {
      color: #27272a;
    }
    .email-muted {
      color: #71717a;
    }
    .email-badge {
      background-color: #f4f4f5;
      color: #09090b;
      border: 1px solid #e4e4e7;
    }
    .email-divider {
      border-bottom: 1px solid #e4e4e7;
    }
    .email-button {
      background-color: #09090b;
      color: #ffffff !important;
      border-radius: 4px;
    }
    .email-tile {
      fill: #09090b;
    }
    .email-mark-fill {
      fill: #ffffff;
    }
    .email-mark-stroke {
      stroke: #ffffff;
    }

    /* Dark Mode Theme Engine */
    @media (prefers-color-scheme: dark) {
      body, .email-wrapper {
        background-color: #09090b !important;
        color: #f4f4f5 !important;
      }
      .email-card {
        background-color: #121215 !important;
        border-color: #27272a !important;
      }
      .email-brand-text, .email-title {
        color: #ffffff !important;
      }
      .email-text {
        color: #e4e4e7 !important;
      }
      .email-muted {
        color: #a1a1aa !important;
      }
      .email-badge {
        background-color: #18181b !important;
        color: #ffffff !important;
        border-color: #27272a !important;
      }
      .email-divider {
        border-bottom-color: #27272a !important;
      }
      .email-button {
        background-color: #ffffff !important;
        color: #09090b !important;
      }
      .email-tile {
        fill: #ffffff !important;
      }
      .email-mark-fill {
        fill: #09090b !important;
      }
      .email-mark-stroke {
        stroke: #09090b !important;
      }
    }
  </style>
</head>
<body>
  <div class="email-wrapper">
    <div class="email-card">
      
      <!-- Architectural Header with Ondel Logo -->
      <div style="padding-bottom: 24px; margin-bottom: 32px;" class="email-divider">
        <table border="0" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td align="left" style="vertical-align: middle;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right: 12px; vertical-align: middle;">
                    <svg width="30" height="30" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                      <rect class="email-tile" width="32" height="32" rx="6" />
                      <g>
                        <rect class="email-mark-fill" x="10.4" y="6.3" width="3.3" height="7.4" rx="1.3" />
                        <rect class="email-mark-fill" x="18.3" y="6.3" width="3.3" height="7.4" rx="1.3" />
                        <path class="email-mark-stroke" d="M7.5 15 A 8.5 8.5 0 0 0 24.5 15" fill="none" stroke-width="3.3" stroke-linecap="round" />
                      </g>
                    </svg>
                  </td>
                  <td style="vertical-align: middle;">
                    <span class="email-brand-text" style="font-size: 22px; font-weight: 800; letter-spacing: -0.04em;">ondel</span>
                  </td>
                </tr>
              </table>
            </td>
            <td align="right" style="vertical-align: middle;">
              <span class="email-badge" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.14em; padding: 5px 12px; border-radius: 4px; font-family: monospace;">${badgeText}</span>
            </td>
          </tr>
        </table>
      </div>

      <!-- Main Title -->
      <h1 class="email-title" style="font-size: 24px; font-weight: 800; letter-spacing: -0.03em; margin: 0 0 16px 0; line-height: 1.25;">
        ${title}
      </h1>

      <!-- Email Content Body -->
      <div class="email-text" style="font-size: 15px; line-height: 1.65; margin-bottom: 32px;">
        ${bodyHtml}
      </div>

      <!-- Call To Action Button (Optional) -->
      ${
        ctaText && ctaUrl
          ? `
      <div style="margin: 32px 0 36px 0;">
        <a href="${ctaUrl}" class="email-button" style="display: inline-block; padding: 14px 32px; font-size: 14px; font-weight: 700; text-decoration: none; letter-spacing: -0.01em; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
          ${ctaText} →
        </a>
      </div>
      `
          : ''
      }

      <!-- Footer & Signature -->
      <div style="padding-top: 28px; margin-top: 36px;" class="email-divider">
        <p class="email-brand-text" style="font-size: 12px; font-weight: 700; margin: 0 0 6px 0; letter-spacing: -0.01em;">
          Ondel Music Platform
        </p>
        <p class="email-muted" style="font-size: 11px; margin: 0 0 16px 0; line-height: 1.5; font-family: monospace; text-transform: uppercase; letter-spacing: 0.06em;">
          AI Operating System for Music Releases
        </p>
        <p class="email-muted" style="font-size: 11px; margin: 0; line-height: 1.5;">
          ${footerText}
        </p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

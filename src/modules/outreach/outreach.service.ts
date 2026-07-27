import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { DeepSeekGeminiAIProvider } from '../../providers/ai/deepseek-gemini.provider';

export interface SendOutreachInput {
  targetId: string;
  recipientEmail: string;
  recipientName?: string;
  organization?: string;
  artistName: string;
  songTitle: string;
  genre: string;
  epkUrl?: string;
  audioUrl?: string;
}

export class OutreachService {
  private static transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // true for port 465, false for 587
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  private static aiProvider = new DeepSeekGeminiAIProvider();

  static async sendPersonalizedPitch(input: SendOutreachInput): Promise<boolean> {
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

    const fromAddress = `"${env.SMTP_FROM_NAME}" <${env.SMTP_USER}>`;
    const replyToAddress = `promo+tgt_${targetId}@${env.SMTP_USER.split('@')[1] || 'ondel.io'}`;

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
    } catch (error: any) {
      console.error(`[OutreachService] Failed to send email to ${recipientEmail}:`, error.message);
      return false;
    }
  }

  private static async generatePitchContent(params: {
    recipientName: string;
    organization: string;
    artistName: string;
    songTitle: string;
    genre: string;
    epkUrl: string;
    audioUrl: string;
  }): Promise<string> {
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

import { ReplyListenerService } from '../modules/outreach/reply-listener.service';
import { env } from '../config/env';

export function startReplyListenerCron() {
  const intervalMs = env.IMAP_POLL_INTERVAL_MINUTES * 60 * 1000;
  console.log(`[ReplyListenerCron] Scheduled Zoho IMAP reply listener every ${env.IMAP_POLL_INTERVAL_MINUTES} minutes.`);

  // Run initial check on startup safely after 10s
  setTimeout(async () => {
    try {
      const res = await ReplyListenerService.checkUnreadReplies();
      if (res.checked > 0) {
        console.log(`[ReplyListenerCron] Checked ${res.checked} unread emails, updated ${res.updated} campaign targets.`);
      }
    } catch (err: any) {
      console.warn('[ReplyListenerCron] Startup check error:', err.message);
    }
  }, 10000);

  // Interval timer
  setInterval(async () => {
    try {
      const res = await ReplyListenerService.checkUnreadReplies();
      if (res.checked > 0) {
        console.log(`[ReplyListenerCron] Checked ${res.checked} unread emails, updated ${res.updated} campaign targets.`);
      }
    } catch (err: any) {
      console.warn('[ReplyListenerCron] Scheduled check error:', err.message);
    }
  }, intervalMs);
}

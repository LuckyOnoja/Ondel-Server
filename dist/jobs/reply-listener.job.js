"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startReplyListenerCron = startReplyListenerCron;
const reply_listener_service_1 = require("../modules/outreach/reply-listener.service");
const env_1 = require("../config/env");
function startReplyListenerCron() {
    const intervalMs = env_1.env.IMAP_POLL_INTERVAL_MINUTES * 60 * 1000;
    console.log(`[ReplyListenerCron] Scheduled Zoho IMAP reply listener every ${env_1.env.IMAP_POLL_INTERVAL_MINUTES} minutes.`);
    // Run initial check on startup safely after 10s
    setTimeout(async () => {
        try {
            const res = await reply_listener_service_1.ReplyListenerService.checkUnreadReplies();
            if (res.checked > 0) {
                console.log(`[ReplyListenerCron] Checked ${res.checked} unread emails, updated ${res.updated} campaign targets.`);
            }
        }
        catch (err) {
            console.warn('[ReplyListenerCron] Startup check error:', err.message);
        }
    }, 10000);
    // Interval timer
    setInterval(async () => {
        try {
            const res = await reply_listener_service_1.ReplyListenerService.checkUnreadReplies();
            if (res.checked > 0) {
                console.log(`[ReplyListenerCron] Checked ${res.checked} unread emails, updated ${res.updated} campaign targets.`);
            }
        }
        catch (err) {
            console.warn('[ReplyListenerCron] Scheduled check error:', err.message);
        }
    }, intervalMs);
}

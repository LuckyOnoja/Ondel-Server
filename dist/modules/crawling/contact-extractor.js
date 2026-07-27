"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactExtractor = void 0;
const client_1 = require("@prisma/client");
class ContactExtractor {
    static EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    static IGNORED_DOMAINS = [
        'example.com',
        'sentry.io',
        'wixpress.com',
        'schema.org',
        'domain.com',
        'png',
        'jpg',
    ];
    static extractContacts(htmlText, pageUrl, links) {
        const contacts = [];
        const seenValues = new Set();
        // 1. Extract Emails from Text & mailto: links
        const rawEmails = htmlText.match(this.EMAIL_REGEX) || [];
        for (const email of rawEmails) {
            const normalized = email.toLowerCase().trim();
            const domain = normalized.split('@')[1];
            if (domain && !this.IGNORED_DOMAINS.includes(domain) && !seenValues.has(normalized)) {
                seenValues.add(normalized);
                contacts.push({
                    type: client_1.ContactPointType.EMAIL,
                    value: normalized,
                    isPublic: true,
                });
            }
        }
        // 2. Extract Submission Links & Social Profiles from href links
        for (const link of links) {
            if (!link)
                continue;
            const lowerLink = link.toLowerCase();
            if (lowerLink.includes('/submit') || lowerLink.includes('/demo') || lowerLink.includes('forms.gle') || lowerLink.includes('submithub') || lowerLink.includes('groover')) {
                if (!seenValues.has(link)) {
                    seenValues.add(link);
                    contacts.push({
                        type: client_1.ContactPointType.SUBMISSION_FORM,
                        value: link,
                        isPublic: true,
                    });
                }
            }
            else if (lowerLink.includes('instagram.com/')) {
                if (!seenValues.has(link)) {
                    seenValues.add(link);
                    contacts.push({ type: client_1.ContactPointType.INSTAGRAM, value: link, isPublic: true });
                }
            }
            else if (lowerLink.includes('spotify.com/')) {
                if (!seenValues.has(link)) {
                    seenValues.add(link);
                    contacts.push({ type: client_1.ContactPointType.SPOTIFY, value: link, isPublic: true });
                }
            }
            else if (lowerLink.includes('youtube.com/')) {
                if (!seenValues.has(link)) {
                    seenValues.add(link);
                    contacts.push({ type: client_1.ContactPointType.YOUTUBE, value: link, isPublic: true });
                }
            }
            else if (lowerLink.includes('tiktok.com/')) {
                if (!seenValues.has(link)) {
                    seenValues.add(link);
                    contacts.push({ type: client_1.ContactPointType.TIKTOK, value: link, isPublic: true });
                }
            }
        }
        return contacts;
    }
}
exports.ContactExtractor = ContactExtractor;

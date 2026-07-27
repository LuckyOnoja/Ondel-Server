import { ContactPointType } from '@prisma/client';

export interface ExtractedContact {
  type: ContactPointType;
  value: string;
  isPublic: boolean;
}

export class ContactExtractor {
  private static EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  private static IGNORED_DOMAINS = [
    'example.com',
    'sentry.io',
    'wixpress.com',
    'schema.org',
    'domain.com',
    'png',
    'jpg',
  ];

  static extractContacts(htmlText: string, pageUrl: string, links: string[]): ExtractedContact[] {
    const contacts: ExtractedContact[] = [];
    const seenValues = new Set<string>();

    // 1. Extract Emails from Text & mailto: links
    const rawEmails = htmlText.match(this.EMAIL_REGEX) || [];
    for (const email of rawEmails) {
      const normalized = email.toLowerCase().trim();
      const domain = normalized.split('@')[1];

      if (domain && !this.IGNORED_DOMAINS.includes(domain) && !seenValues.has(normalized)) {
        seenValues.add(normalized);
        contacts.push({
          type: ContactPointType.EMAIL,
          value: normalized,
          isPublic: true,
        });
      }
    }

    // 2. Extract Submission Links & Social Profiles from href links
    for (const link of links) {
      if (!link) continue;
      const lowerLink = link.toLowerCase();

      if (lowerLink.includes('/submit') || lowerLink.includes('/demo') || lowerLink.includes('forms.gle') || lowerLink.includes('submithub') || lowerLink.includes('groover')) {
        if (!seenValues.has(link)) {
          seenValues.add(link);
          contacts.push({
            type: ContactPointType.SUBMISSION_FORM,
            value: link,
            isPublic: true,
          });
        }
      } else if (lowerLink.includes('instagram.com/')) {
        if (!seenValues.has(link)) {
          seenValues.add(link);
          contacts.push({ type: ContactPointType.INSTAGRAM, value: link, isPublic: true });
        }
      } else if (lowerLink.includes('spotify.com/')) {
        if (!seenValues.has(link)) {
          seenValues.add(link);
          contacts.push({ type: ContactPointType.SPOTIFY, value: link, isPublic: true });
        }
      } else if (lowerLink.includes('youtube.com/')) {
        if (!seenValues.has(link)) {
          seenValues.add(link);
          contacts.push({ type: ContactPointType.YOUTUBE, value: link, isPublic: true });
        }
      } else if (lowerLink.includes('tiktok.com/')) {
        if (!seenValues.has(link)) {
          seenValues.add(link);
          contacts.push({ type: ContactPointType.TIKTOK, value: link, isPublic: true });
        }
      }
    }

    return contacts;
  }
}

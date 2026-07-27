import { LeadCategory } from '@prisma/client';

export interface AIEnrichmentResult {
  category: LeadCategory;
  organization?: string;
  name?: string;
  genres: string[];
  acceptsSubmissions: boolean;
  confidence: number;
  evidence: string[];
}

export interface AIProvider {
  name: string;
  enrichLeadContent(pageTitle: string, pageText: string, searchGenre: string): Promise<AIEnrichmentResult | null>;
}

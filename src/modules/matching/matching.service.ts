import { prisma } from '../../config/prisma';
import { LeadCategory, LeadStatus } from '@prisma/client';

export interface MatchingQueryInput {
  categories?: LeadCategory[];
  genres: string[];
  countries?: string[];
  limit?: number;
}

export class MatchingService {
  static async matchLeadsForCampaign(input: MatchingQueryInput) {
    const { categories, genres, countries, limit = 20 } = input;

    const where: any = {
      acceptsSubmissions: true,
    };

    if (categories && categories.length > 0) {
      where.category = { in: categories };
    }

    if (countries && countries.length > 0) {
      where.country = { in: countries };
    }

    if (genres && genres.length > 0) {
      where.genres = { hasSome: genres };
    }

    const leads = await prisma.lead.findMany({
      where,
      take: limit,
      orderBy: [
        { relevanceScore: 'desc' },
        { createdAt: 'desc' },
      ],
      include: {
        contactPoints: true,
        sources: true,
        tags: true,
      },
    });

    return {
      totalMatches: leads.length,
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name,
        organization: lead.organization,
        category: lead.category,
        country: lead.country,
        genres: lead.genres,
        verifiedContacts: lead.contactPoints,
        relevanceScore: lead.relevanceScore || 0.85,
      })),
    };
  }

  static async matchLeadsForSong(songId: string, limit = 20) {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { artist: true },
    });

    if (!song) {
      throw new Error(`Song with ID ${songId} not found`);
    }

    const songMetadata: any = song.metadata || {};
    const primaryGenre = song.genre.toLowerCase();
    const subgenres = (song.subgenres || []).map((s) => s.toLowerCase());
    const referenceArtists = (song.similarArtists || []).map((a) => a.toLowerCase());
    const songCountry = song.artist?.country ? song.artist.country.toLowerCase() : null;

    // Retrieve candidate leads that match genre OR country (regional wildcard) OR subgenres
    const candidateLeads = await prisma.lead.findMany({
      where: {
        acceptsSubmissions: true,
      },
      include: {
        contactPoints: true,
        tags: true,
      },
      take: limit * 3, // Over-fetch candidates to perform weighted scoring
    });

    // Score candidate leads
    const scoredLeads = candidateLeads.map((lead) => {
      let score = 0.50; // Base baseline score

      const leadGenres = (lead.genres || []).map((g) => g.toLowerCase());
      const leadCountry = lead.country ? lead.country.toLowerCase() : null;
      const leadTags = (lead.tags || []).map((t) => t.tag.toLowerCase());

      // 1. Primary Genre Match (+0.25)
      const hasPrimaryGenreMatch = leadGenres.some((g) => g.includes(primaryGenre) || primaryGenre.includes(g));
      if (hasPrimaryGenreMatch) {
        score += 0.25;
      }

      // 2. Subgenre Match (+0.15)
      const hasSubgenreMatch = subgenres.some((sub) => leadGenres.some((g) => g.includes(sub) || sub.includes(g)));
      if (hasSubgenreMatch) {
        score += 0.15;
      }

      // 3. Reference Artist & Tag Overlap (+0.10)
      const hasReferenceArtistMatch = referenceArtists.some((ref) =>
        leadTags.some((tag) => tag.includes(ref) || ref.includes(tag))
      );
      if (hasReferenceArtistMatch) {
        score += 0.10;
      }

      // 4. Regional / Country Wildcard Match (+0.10)
      // Curators in the artist's region match even across genres
      if (songCountry && leadCountry && (leadCountry === songCountry || leadCountry.includes(songCountry))) {
        score += 0.10;
      }

      // 5. Verified Contact Bonus (+0.05)
      if (lead.contactPoints.some((cp) => cp.isVerified)) {
        score += 0.05;
      }

      const finalRelevanceScore = Math.min(0.99, parseFloat(score.toFixed(2)));

      return {
        id: lead.id,
        name: lead.name,
        organization: lead.organization,
        category: lead.category,
        country: lead.country,
        genres: lead.genres,
        verifiedContacts: lead.contactPoints,
        relevanceScore: finalRelevanceScore,
        matchReasons: [
          ...(hasPrimaryGenreMatch ? [`Matches genre "${song.genre}"`] : []),
          ...(hasSubgenreMatch ? ['Matches subgenre & vibe tags'] : []),
          ...(hasReferenceArtistMatch ? ['Similar reference artist match'] : []),
          ...(songCountry && leadCountry === songCountry ? [`Regional curator for ${lead.country}`] : []),
        ],
      };
    });

    // Sort by relevance score descending
    scoredLeads.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const finalMatches = scoredLeads.slice(0, limit);

    return {
      songId,
      songTitle: song.title,
      genre: song.genre,
      subgenres: song.subgenres,
      soundVibe: song.soundVibe,
      similarArtists: song.similarArtists,
      scrutinizedAt: songMetadata.scrutinizedAt || null,
      totalMatches: finalMatches.length,
      leads: finalMatches,
    };
  }
}

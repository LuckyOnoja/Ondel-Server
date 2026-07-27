import { LeadCategory } from '@prisma/client';

export interface QueryBuilderInput {
  categories: LeadCategory[];
  genres: string[];
  countries?: string[];
}

export class QueryBuilder {
  static generateQueries(input: QueryBuilderInput): string[] {
    const queries: string[] = [];
    const countries = input.countries && input.countries.length > 0 ? input.countries : [''];

    for (const category of input.categories) {
      for (const genre of input.genres) {
        for (const country of countries) {
          const location = country ? ` ${country}` : '';
          const categoryTemplates = this.getCategoryTemplates(category);

          for (const template of categoryTemplates) {
            const query = template
              .replace('{genre}', genre)
              .replace('{location}', location)
              .trim();
            queries.push(query);
          }
        }
      }
    }

    return [...new Set(queries)];
  }

  private static getCategoryTemplates(category: LeadCategory): string[] {
    switch (category) {
      case LeadCategory.PLAYLIST_CURATOR:
        return [
          '{genre} playlist curator{location}',
          '{genre} Spotify playlist submit music{location}',
          '{genre} playlist submission{location}',
          'independent playlist curator {genre}{location}',
          'send song {genre} playlist{location}',
        ];
      case LeadCategory.RADIO_STATION:
      case LeadCategory.RADIO_DJ:
        return [
          '{genre} radio station music submission{location}',
          '{genre} radio DJ submit demo{location}',
          'independent radio station {genre} contact{location}',
          'send track {genre} radio{location}',
        ];
      case LeadCategory.RECORD_LABEL:
      case LeadCategory.A_AND_R:
        return [
          '{genre} record label demo submission{location}',
          '{genre} A&R contact email{location}',
          'independent record label {genre} submit music{location}',
        ];
      case LeadCategory.MUSIC_BLOG:
      case LeadCategory.MUSIC_PUBLICATION:
        return [
          '{genre} music blog submit music{location}',
          '{genre} music publication contact{location}',
          'submit track {genre} blog review{location}',
        ];
      case LeadCategory.YOUTUBE_CHANNEL:
        return [
          '{genre} YouTube music channel submission{location}',
          '{genre} music promoter YouTube contact{location}',
        ];
      default:
        return [
          '{genre} music submission contact{location}',
          '{genre} music curator contact{location}',
        ];
    }
  }
}

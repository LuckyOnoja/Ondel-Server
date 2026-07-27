"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryBuilder = void 0;
const client_1 = require("@prisma/client");
class QueryBuilder {
    static generateQueries(input) {
        const queries = [];
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
    static getCategoryTemplates(category) {
        switch (category) {
            case client_1.LeadCategory.PLAYLIST_CURATOR:
                return [
                    '"{genre}" "playlist curator"{location}',
                    '"{genre}" "Spotify playlist" "submit music"{location}',
                    '"{genre}" "playlist submission"{location}',
                    '"independent playlist curator" "{genre}"{location}',
                    '"send your song" "{genre}" playlist{location}',
                ];
            case client_1.LeadCategory.RADIO_STATION:
            case client_1.LeadCategory.RADIO_DJ:
                return [
                    '"{genre}" radio station "music submission"{location}',
                    '"{genre}" radio DJ "submit demo"{location}',
                    'independent radio station "{genre}" contact{location}',
                    '"send track" "{genre}" radio{location}',
                ];
            case client_1.LeadCategory.RECORD_LABEL:
            case client_1.LeadCategory.A_AND_R:
                return [
                    '"{genre}" record label "demo submission"{location}',
                    '"{genre}" A&R contact email{location}',
                    'independent record label "{genre}" submit music{location}',
                ];
            case client_1.LeadCategory.MUSIC_BLOG:
            case client_1.LeadCategory.MUSIC_PUBLICATION:
                return [
                    '"{genre}" music blog "submit music"{location}',
                    '"{genre}" music publication contact{location}',
                    'submit track "{genre}" blog review{location}',
                ];
            case client_1.LeadCategory.YOUTUBE_CHANNEL:
                return [
                    '"{genre}" YouTube music channel submission{location}',
                    '"{genre}" music promoter YouTube contact{location}',
                ];
            default:
                return [
                    '"{genre}" music submission contact{location}',
                    '"{genre}" music curator contact{location}',
                ];
        }
    }
}
exports.QueryBuilder = QueryBuilder;

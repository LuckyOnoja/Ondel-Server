"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpotifyService = void 0;
const axios_1 = __importDefault(require("axios"));
const env_1 = require("../config/env");
class SpotifyService {
    static cachedToken = null;
    static tokenExpiresAt = 0;
    static async getAccessToken() {
        const clientId = env_1.env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
        const clientSecret = env_1.env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            console.warn('[SpotifyService] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET missing in environment');
            return null;
        }
        if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
            return this.cachedToken;
        }
        try {
            const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
            const response = await axios_1.default.post('https://accounts.spotify.com/api/token', 'grant_type=client_credentials', {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                timeout: 8000,
            });
            this.cachedToken = response.data.access_token;
            this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
            return this.cachedToken;
        }
        catch (err) {
            console.error('[SpotifyService] Failed to obtain client credentials access token:', err.message);
            return null;
        }
    }
    static extractTrackId(urlOrId) {
        if (!urlOrId)
            return '';
        if (urlOrId.includes('spotify.com/track/')) {
            const match = urlOrId.match(/track\/([a-zA-Z0-9]+)/);
            return match ? match[1] : '';
        }
        return urlOrId.trim();
    }
    static async getAudioFeatures(trackUrlOrId) {
        const trackId = this.extractTrackId(trackUrlOrId);
        if (!trackId)
            return null;
        const token = await this.getAccessToken();
        if (!token)
            return null;
        try {
            const response = await axios_1.default.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });
            return response.data;
        }
        catch (err) {
            console.warn(`[SpotifyService] Error fetching audio features for track ${trackId}:`, err.message);
            return null;
        }
    }
    static async getRelatedArtistsByName(artistName) {
        if (!artistName)
            return [];
        const token = await this.getAccessToken();
        if (!token)
            return [];
        try {
            // 1. Search artist ID
            const searchRes = await axios_1.default.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });
            const artistId = searchRes.data?.artists?.items?.[0]?.id;
            if (!artistId)
                return [];
            // 2. Fetch related artists
            const relatedRes = await axios_1.default.get(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 8000,
            });
            const artists = relatedRes.data?.artists || [];
            return artists.slice(0, 5).map((a) => a.name);
        }
        catch (err) {
            console.warn(`[SpotifyService] Error searching related artists for ${artistName}:`, err.message);
            return [];
        }
    }
}
exports.SpotifyService = SpotifyService;

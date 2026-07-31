import axios from 'axios';
import { env } from '../config/env';

interface SpotifyAudioFeatures {
  danceability: number;
  energy: number;
  key: number;
  loudness: number;
  mode: number;
  speechiness: number;
  acousticness: number;
  instrumentalness: number;
  liveness: number;
  valence: number;
  tempo: number;
  duration_ms: number;
  time_signature: number;
}

export class SpotifyService {
  private static cachedToken: string | null = null;
  private static tokenExpiresAt: number = 0;

  static async getAccessToken(): Promise<string | null> {
    const clientId = env.SPOTIFY_CLIENT_ID || process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = env.SPOTIFY_CLIENT_SECRET || process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      console.warn('[SpotifyService] SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET missing in environment');
      return null;
    }

    if (this.cachedToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.cachedToken;
    }

    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        'grant_type=client_credentials',
        {
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 8000,
        }
      );

      this.cachedToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + response.data.expires_in * 1000;
      return this.cachedToken;
    } catch (err: any) {
      console.error('[SpotifyService] Failed to obtain client credentials access token:', err.message);
      return null;
    }
  }

  static extractTrackId(urlOrId: string): string {
    if (!urlOrId) return '';
    if (urlOrId.includes('spotify.com/track/')) {
      const match = urlOrId.match(/track\/([a-zA-Z0-9]+)/);
      return match ? match[1] : '';
    }
    return urlOrId.trim();
  }

  static async getAudioFeatures(trackUrlOrId: string): Promise<SpotifyAudioFeatures | null> {
    const trackId = this.extractTrackId(trackUrlOrId);
    if (!trackId) return null;

    const token = await this.getAccessToken();
    if (!token) return null;

    try {
      const response = await axios.get(`https://api.spotify.com/v1/audio-features/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });

      return response.data;
    } catch (err: any) {
      console.warn(`[SpotifyService] Error fetching audio features for track ${trackId}:`, err.message);
      return null;
    }
  }

  static async getRelatedArtistsByName(artistName: string): Promise<string[]> {
    if (!artistName) return [];
    const token = await this.getAccessToken();
    if (!token) return [];

    try {
      // 1. Search artist ID
      const searchRes = await axios.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&limit=1`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 8000,
        }
      );

      const artistId = searchRes.data?.artists?.items?.[0]?.id;
      if (!artistId) return [];

      // 2. Fetch related artists
      const relatedRes = await axios.get(`https://api.spotify.com/v1/artists/${artistId}/related-artists`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 8000,
      });

      const artists = relatedRes.data?.artists || [];
      return artists.slice(0, 5).map((a: any) => a.name);
    } catch (err: any) {
      console.warn(`[SpotifyService] Error searching related artists for ${artistName}:`, err.message);
      return [];
    }
  }
}

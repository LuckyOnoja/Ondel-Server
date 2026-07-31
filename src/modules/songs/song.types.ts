import { z } from 'zod';

export const CreateSongSchema = z.object({
  userId: z.string().min(1),
  artistName: z.string().min(1),
  title: z.string().min(1),
  genre: z.string().min(1),
  subgenres: z.array(z.string()).optional().default([]),
  spotifyUrl: z.string().optional(),
  epkUrl: z.string().optional(),
  similarArtists: z.array(z.string()).optional().default([]),
  soundVibe: z.string().optional(),
});

export type CreateSongDTO = z.infer<typeof CreateSongSchema>;

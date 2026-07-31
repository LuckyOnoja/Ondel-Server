"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateSongSchema = void 0;
const zod_1 = require("zod");
exports.CreateSongSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    artistName: zod_1.z.string().min(1),
    title: zod_1.z.string().min(1),
    genre: zod_1.z.string().min(1),
    subgenres: zod_1.z.array(zod_1.z.string()).optional().default([]),
    spotifyUrl: zod_1.z.string().optional(),
    epkUrl: zod_1.z.string().optional(),
    similarArtists: zod_1.z.array(zod_1.z.string()).optional().default([]),
    soundVibe: zod_1.z.string().optional(),
});

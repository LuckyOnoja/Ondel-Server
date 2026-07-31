"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCampaignSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.CreateCampaignSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    songId: zod_1.z.string().min(1),
    type: zod_1.z.nativeEnum(client_1.CampaignType).optional().default(client_1.CampaignType.GENERAL),
    goal: zod_1.z.string().optional().default('Playlist Pitching & Radio Outreach'),
    // Fields for GENERAL campaign:
    targetCategories: zod_1.z.array(zod_1.z.nativeEnum(client_1.LeadCategory)).optional(),
    targetGenres: zod_1.z.array(zod_1.z.string()).optional(),
    targetCountries: zod_1.z.array(zod_1.z.string()).optional(),
    budgetCredits: zod_1.z.number().int().positive().optional(),
    // Fields for TARGETED / Single-Playlister campaign:
    targetLeadIds: zod_1.z.array(zod_1.z.string()).optional(),
    // Flag to launch immediately after creation
    autoLaunch: zod_1.z.boolean().optional().default(false),
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateCampaignSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.CreateCampaignSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    songId: zod_1.z.string().min(1),
    goal: zod_1.z.string().min(1),
    targetCategories: zod_1.z.array(zod_1.z.nativeEnum(client_1.LeadCategory)).min(1),
    targetGenres: zod_1.z.array(zod_1.z.string()).min(1),
    targetCountries: zod_1.z.array(zod_1.z.string()).optional(),
    budgetCredits: zod_1.z.number().int().positive(),
});

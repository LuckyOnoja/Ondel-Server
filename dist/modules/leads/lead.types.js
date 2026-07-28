"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueryLeadSchema = exports.CreateLeadSchema = exports.CreateContactPointSchema = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
exports.CreateContactPointSchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(client_1.ContactPointType),
    value: zod_1.z.string().min(1),
    isPublic: zod_1.z.boolean().optional().default(true),
    isVerified: zod_1.z.boolean().optional(),
    verification: zod_1.z.any().optional(),
});
exports.CreateLeadSchema = zod_1.z.object({
    name: zod_1.z.string().optional(),
    organization: zod_1.z.string().optional(),
    category: zod_1.z.nativeEnum(client_1.LeadCategory),
    country: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    genres: zod_1.z.array(zod_1.z.string()).optional().default([]),
    acceptsSubmissions: zod_1.z.boolean().optional().default(false),
    status: zod_1.z.nativeEnum(client_1.LeadStatus).optional().default(client_1.LeadStatus.DISCOVERED),
    sourceUrl: zod_1.z.string().url().optional(),
    sourceType: zod_1.z.string().optional(),
    metadata: zod_1.z.record(zod_1.z.any()).optional(),
    contactPoints: zod_1.z.array(exports.CreateContactPointSchema).optional().default([]),
    tags: zod_1.z.array(zod_1.z.string()).optional().default([]),
});
exports.QueryLeadSchema = zod_1.z.object({
    category: zod_1.z.nativeEnum(client_1.LeadCategory).optional(),
    status: zod_1.z.nativeEnum(client_1.LeadStatus).optional(),
    country: zod_1.z.string().optional(),
    genre: zod_1.z.string().optional(),
    search: zod_1.z.string().optional(),
    page: zod_1.z.string().transform(Number).optional().default('1'),
    limit: zod_1.z.string().transform(Number).optional().default('20'),
});

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchingController = void 0;
const matching_service_1 = require("./matching.service");
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const MatchSearchSchema = zod_1.z.object({
    categories: zod_1.z.array(zod_1.z.nativeEnum(client_1.LeadCategory)).optional(),
    genres: zod_1.z.array(zod_1.z.string()).min(1),
    countries: zod_1.z.array(zod_1.z.string()).optional(),
    limit: zod_1.z.number().optional().default(20),
});
class MatchingController {
    static async searchMatches(req, res) {
        try {
            const validated = MatchSearchSchema.parse(req.body);
            const results = await matching_service_1.MatchingService.matchLeadsForCampaign(validated);
            res.status(200).json({ success: true, data: results });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
}
exports.MatchingController = MatchingController;

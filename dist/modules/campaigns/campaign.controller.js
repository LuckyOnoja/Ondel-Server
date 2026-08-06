"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CampaignController = void 0;
const campaign_service_1 = require("./campaign.service");
const campaign_types_1 = require("./campaign.types");
class CampaignController {
    static async createCampaign(req, res) {
        try {
            const validated = campaign_types_1.CreateCampaignSchema.parse(req.body);
            const campaign = await campaign_service_1.CampaignService.createCampaign(validated);
            res.status(201).json({ success: true, data: campaign });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async launchCampaign(req, res) {
        try {
            const id = String(req.params.id);
            const result = await campaign_service_1.CampaignService.launchCampaign(id);
            res.status(200).json({ success: true, data: result });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
    static async getCampaign(req, res) {
        try {
            const id = String(req.params.id);
            const campaign = await campaign_service_1.CampaignService.getCampaign(id);
            res.status(200).json({ success: true, data: campaign });
        }
        catch (error) {
            res.status(404).json({ success: false, error: error.message || error });
        }
    }
    static async getUserCampaigns(req, res) {
        try {
            const userId = String(req.user?.userId || req.user?.id || req.params.userId || req.query.userId || '');
            const projectId = req.query.projectId ? String(req.query.projectId) : undefined;
            if (!userId || userId === 'undefined') {
                res.status(400).json({ success: false, error: 'userId is required' });
                return;
            }
            const campaigns = await campaign_service_1.CampaignService.getUserCampaigns(userId, projectId);
            res.status(200).json({ success: true, data: campaigns });
        }
        catch (error) {
            res.status(400).json({ success: false, error: error.message || error });
        }
    }
}
exports.CampaignController = CampaignController;

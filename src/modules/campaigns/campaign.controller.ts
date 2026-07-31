import { Request, Response } from 'express';
import { CampaignService } from './campaign.service';
import { CreateCampaignSchema } from './campaign.types';

export class CampaignController {
  static async createCampaign(req: Request, res: Response): Promise<void> {
    try {
      const validated = CreateCampaignSchema.parse(req.body);
      const campaign = await CampaignService.createCampaign(validated);
      res.status(201).json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async launchCampaign(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const result = await CampaignService.launchCampaign(id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }

  static async getCampaign(req: Request, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const campaign = await CampaignService.getCampaign(id);
      res.status(200).json({ success: true, data: campaign });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message || error });
    }
  }

  static async getUserCampaigns(req: Request, res: Response): Promise<void> {
    try {
      const userId = String(req.params.userId || req.query.userId);
      if (!userId || userId === 'undefined') {
        res.status(400).json({ success: false, error: 'userId is required' });
        return;
      }
      const campaigns = await CampaignService.getUserCampaigns(userId);
      res.status(200).json({ success: true, data: campaigns });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message || error });
    }
  }
}

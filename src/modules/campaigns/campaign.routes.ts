import { Router } from 'express';
import { CampaignController } from './campaign.controller';

const router = Router();

router.post('/', CampaignController.createCampaign);
router.get('/:id', CampaignController.getCampaign);
router.post('/:id/launch', CampaignController.launchCampaign);

export default router;

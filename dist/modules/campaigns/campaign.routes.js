"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const campaign_controller_1 = require("./campaign.controller");
const router = (0, express_1.Router)();
router.post('/', campaign_controller_1.CampaignController.createCampaign);
router.get('/:id', campaign_controller_1.CampaignController.getCampaign);
router.post('/:id/launch', campaign_controller_1.CampaignController.launchCampaign);
exports.default = router;

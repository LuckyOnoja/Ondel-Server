import { Router } from 'express';
import { WebhookController } from './webhook.controller';

const router = Router();

router.post('/zoho-email', WebhookController.handleZohoEmailWebhook);
router.post('/email', WebhookController.handleZohoEmailWebhook);

export default router;

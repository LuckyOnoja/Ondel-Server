import { Router } from 'express';
import { CreditController } from './credit.controller';

const router = Router();

router.get('/balance', CreditController.getBalance);
router.post('/purchase', CreditController.purchaseCredits);

export default router;

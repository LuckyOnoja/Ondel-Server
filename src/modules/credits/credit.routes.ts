import { Router } from 'express';
import { CreditController } from './credit.controller';
import { requireAuth } from '../../middleware/authMiddleware';

const router = Router();

router.get('/balance', requireAuth, CreditController.getBalance);
router.post('/purchase', requireAuth, CreditController.purchaseCredits);

export default router;

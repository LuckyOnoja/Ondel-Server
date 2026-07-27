import { Router } from 'express';
import { LeadController } from './lead.controller';

const router = Router();

router.post('/', LeadController.createLead);
router.get('/', LeadController.getLeads);
router.get('/:id', LeadController.getLeadById);
router.patch('/:id/status', LeadController.updateStatus);

export default router;

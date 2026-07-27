import { Router } from 'express';
import { DiscoveryController } from './discovery.controller';

const router = Router();

router.post('/jobs', DiscoveryController.createJob);
router.get('/jobs/:id', DiscoveryController.getJobStatus);

export default router;

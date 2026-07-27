import { Router } from 'express';
import { MatchingController } from './matching.controller';

const router = Router();

router.post('/search', MatchingController.searchMatches);

export default router;

import { Router } from 'express';
import { MatchingController } from './matching.controller';

const router = Router();

router.post('/search', MatchingController.searchMatches);
router.get('/song/:songId', MatchingController.getMatchesForSong);

export default router;

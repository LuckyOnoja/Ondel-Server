import { Router } from 'express';
import { TestSubmissionController } from './test-submission.controller';

const router = Router();

router.post('/', TestSubmissionController.create);
router.get('/', TestSubmissionController.list);

export default router;

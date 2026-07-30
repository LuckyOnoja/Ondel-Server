"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const test_submission_controller_1 = require("./test-submission.controller");
const router = (0, express_1.Router)();
router.post('/', test_submission_controller_1.TestSubmissionController.create);
router.get('/', test_submission_controller_1.TestSubmissionController.list);
exports.default = router;

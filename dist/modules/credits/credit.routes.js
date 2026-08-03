"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const credit_controller_1 = require("./credit.controller");
const authMiddleware_1 = require("../../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.get('/balance', authMiddleware_1.requireAuth, credit_controller_1.CreditController.getBalance);
router.post('/purchase', authMiddleware_1.requireAuth, credit_controller_1.CreditController.purchaseCredits);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const credit_controller_1 = require("./credit.controller");
const router = (0, express_1.Router)();
router.get('/balance', credit_controller_1.CreditController.getBalance);
router.post('/purchase', credit_controller_1.CreditController.purchaseCredits);
exports.default = router;

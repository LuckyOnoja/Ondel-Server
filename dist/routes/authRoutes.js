"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authController_js_1 = require("../controllers/authController.js");
const rateLimiter_js_1 = require("../middleware/rateLimiter.js");
const authMiddleware_js_1 = require("../middleware/authMiddleware.js");
const router = (0, express_1.Router)();
// 1. Email OTP Request -> Saved in Redis, OTP sent via email
router.post('/send-otp', rateLimiter_js_1.otpRateLimiter, authController_js_1.sendOtp);
// 2. OTP Verification -> Validates against Redis, saves user to PostgreSQL DB on success
router.post('/verify-otp', rateLimiter_js_1.loginRateLimiter, authController_js_1.verifyOtp);
// 3. Google OAuth -> Directly saves user to PostgreSQL DB (bypasses OTP)
router.post('/google', rateLimiter_js_1.loginRateLimiter, authController_js_1.googleAuth);
// 4. Authenticated profile check
router.get('/me', authMiddleware_js_1.requireAuth, authController_js_1.getCurrentUser);
exports.default = router;

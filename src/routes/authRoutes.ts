import { Router } from 'express';
import { sendOtp, verifyOtp, googleAuth, getCurrentUser } from '../controllers/authController.js';
import { otpRateLimiter, loginRateLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

// 1. Email OTP Request -> Saved in Redis, OTP sent via email
router.post('/send-otp', otpRateLimiter, sendOtp);

// 2. OTP Verification -> Validates against Redis, saves user to PostgreSQL DB on success
router.post('/verify-otp', loginRateLimiter, verifyOtp);

// 3. Google OAuth -> Directly saves user to PostgreSQL DB (bypasses OTP)
router.post('/google', loginRateLimiter, googleAuth);

// 4. Authenticated profile check
router.get('/me', requireAuth, getCurrentUser);

export default router;

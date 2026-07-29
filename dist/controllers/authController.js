"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtp = sendOtp;
exports.verifyOtp = verifyOtp;
exports.googleAuth = googleAuth;
exports.getCurrentUser = getCurrentUser;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const axios_1 = __importDefault(require("axios"));
const prisma_js_1 = require("../config/prisma.js");
const redis_js_1 = require("../config/redis.js");
const mailer_js_1 = require("../config/mailer.js");
const env_js_1 = require("../config/env.js");
const googleClient = new google_auth_library_1.OAuth2Client();
// Generate random 6-digit numeric OTP
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
// Generate JWT token
function generateToken(userId, email, authProvider) {
    return jsonwebtoken_1.default.sign({ userId, email, authProvider }, env_js_1.env.JWT_SECRET, { expiresIn: env_js_1.env.JWT_EXPIRES_IN });
}
/**
 * Step 1: Request OTP
 * Stores email & OTP temporarily in Redis (10-min expiration).
 * Email is NOT written to PostgreSQL yet!
 */
async function sendOtp(req, res) {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string' || !email.includes('@')) {
            res.status(400).json({ success: false, message: 'Valid email address is required' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const otp = generateOtp();
        // Redis key for OTP (10 minutes = 600 seconds)
        const redisKey = `otp:${normalizedEmail}`;
        const otpPayload = JSON.stringify({
            otp,
            createdAt: Date.now(),
            attempts: 0,
        });
        // Save in Redis (10-minute expiry)
        await redis_js_1.redisCache.set(redisKey, otpPayload, 600);
        // Dispatch email
        await (0, mailer_js_1.sendOtpEmail)(normalizedEmail, otp);
        res.status(200).json({
            success: true,
            message: 'Verification code sent to your email',
            email: normalizedEmail,
        });
    }
    catch (error) {
        console.error('[sendOtp error]:', error);
        res.status(500).json({ success: false, message: 'Internal server error processing OTP request' });
    }
}
/**
 * Step 2: Verify OTP
 * Checks submitted OTP against Redis.
 * ONLY upon successful verification is the user persisted into PostgreSQL DB!
 */
async function verifyOtp(req, res) {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({ success: false, message: 'Email and verification code (OTP) are required' });
            return;
        }
        const normalizedEmail = email.toLowerCase().trim();
        const redisKey = `otp:${normalizedEmail}`;
        // Retrieve pending OTP from Redis
        const cachedData = await redis_js_1.redisCache.get(redisKey);
        if (!cachedData) {
            res.status(400).json({
                success: false,
                message: 'Verification code has expired or was not requested. Please request a new code.',
            });
            return;
        }
        const parsed = JSON.parse(cachedData);
        if (parsed.otp !== otp.toString().trim()) {
            // Track failed attempts in Redis
            parsed.attempts = (parsed.attempts || 0) + 1;
            if (parsed.attempts >= 5) {
                await redis_js_1.redisCache.del(redisKey);
                res.status(400).json({ success: false, message: 'Too many invalid attempts. Code invalidated.' });
                return;
            }
            await redis_js_1.redisCache.set(redisKey, JSON.stringify(parsed), 600);
            res.status(400).json({ success: false, message: 'Invalid verification code' });
            return;
        }
        // OTP Verified! Delete temporary code from Redis
        await redis_js_1.redisCache.del(redisKey);
        // NOW save / update user directly in PostgreSQL via Prisma!
        let user = await prisma_js_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            user = await prisma_js_1.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    authProvider: 'EMAIL',
                    isVerified: true,
                },
            });
        }
        else if (!user.isVerified) {
            user = await prisma_js_1.prisma.user.update({
                where: { id: user.id },
                data: { isVerified: true },
            });
        }
        // Issue JWT Token
        const token = generateToken(user.id, user.email, user.authProvider);
        res.status(200).json({
            success: true,
            message: 'Authentication successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                authProvider: user.authProvider,
                isVerified: user.isVerified,
            },
        });
    }
    catch (error) {
        console.error('[verifyOtp error]:', error);
        res.status(500).json({ success: false, message: 'Internal server error verifying OTP' });
    }
}
/**
 * Google Auth / OAuth Callback
 * Bypasses OTP flow — directly persists user to PostgreSQL DB automatically.
 */
async function googleAuth(req, res) {
    try {
        const { credential, email, name, avatarUrl, googleId } = req.body;
        let userEmail = email;
        let userName = name;
        let userAvatar = avatarUrl;
        let gId = googleId;
        // Verify Google ID token or Access Token if credential is provided
        if (credential) {
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: env_js_1.env.GOOGLE_CLIENT_ID || undefined,
                });
                const payload = ticket.getPayload();
                if (payload) {
                    userEmail = payload.email;
                    userName = payload.name;
                    userAvatar = payload.picture;
                    gId = payload.sub;
                }
            }
            catch (tokenErr) {
                // Fallback: Check if credential is an access token
                try {
                    const userInfoRes = await axios_1.default.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                        headers: { Authorization: `Bearer ${credential}` },
                    });
                    if (userInfoRes.data?.email) {
                        userEmail = userInfoRes.data.email;
                        userName = userInfoRes.data.name;
                        userAvatar = userInfoRes.data.picture;
                        gId = userInfoRes.data.sub;
                    }
                }
                catch (accessErr) {
                    console.warn('⚠️ [Google Token Verification Failed]:', tokenErr);
                }
            }
        }
        if (!userEmail) {
            res.status(400).json({ success: false, message: 'Email is required for Google Sign-In' });
            return;
        }
        const normalizedEmail = userEmail.toLowerCase().trim();
        // Directly save / upsert into PostgreSQL DB
        let user = await prisma_js_1.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        if (!user) {
            user = await prisma_js_1.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    name: userName || normalizedEmail.split('@')[0],
                    avatarUrl: userAvatar,
                    authProvider: 'GOOGLE',
                    googleId: gId,
                    isVerified: true,
                },
            });
        }
        else {
            user = await prisma_js_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    isVerified: true,
                    googleId: gId || user.googleId,
                    avatarUrl: userAvatar || user.avatarUrl,
                    name: userName || user.name,
                },
            });
        }
        // Issue JWT Token
        const token = generateToken(user.id, user.email, user.authProvider);
        res.status(200).json({
            success: true,
            message: 'Google Authentication successful',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                authProvider: user.authProvider,
                isVerified: user.isVerified,
            },
        });
    }
    catch (error) {
        console.error('[googleAuth error]:', error);
        res.status(500).json({ success: false, message: 'Internal server error processing Google Auth' });
    }
}
/**
 * Get current authenticated user details
 */
async function getCurrentUser(req, res) {
    try {
        if (!req.user?.userId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const user = await prisma_js_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                email: true,
                name: true,
                avatarUrl: true,
                authProvider: true,
                isVerified: true,
                createdAt: true,
            },
        });
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        res.status(200).json({ success: true, user });
    }
    catch (error) {
        console.error('[getCurrentUser error]:', error);
        res.status(500).json({ success: false, message: 'Server error fetching user profile' });
    }
}

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/prisma.js';
import { redisCache } from '../config/redis.js';
import { sendOtpEmail } from '../config/mailer.js';
import { env } from '../config/env.js';
import { AuthRequest } from '../middleware/authMiddleware.js';

const googleClient = new OAuth2Client();

// Generate random 6-digit numeric OTP
function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT token
function generateToken(userId: string, email: string, authProvider: string): string {
  return jwt.sign(
    { userId, email, authProvider },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as any }
  );
}

/**
 * Step 1: Request OTP
 * Stores email & OTP temporarily in Redis (10-min expiration).
 * Email is NOT written to PostgreSQL yet!
 */
export async function sendOtp(req: Request, res: Response): Promise<void> {
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
    await redisCache.set(redisKey, otpPayload, 600);

    // Dispatch email
    await sendOtpEmail(normalizedEmail, otp);

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email',
      email: normalizedEmail,
    });
  } catch (error: any) {
    console.error('[sendOtp error]:', error);
    res.status(500).json({ success: false, message: 'Internal server error processing OTP request' });
  }
}

/**
 * Step 2: Verify OTP
 * Checks submitted OTP against Redis.
 * ONLY upon successful verification is the user persisted into PostgreSQL DB!
 */
export async function verifyOtp(req: Request, res: Response): Promise<void> {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({ success: false, message: 'Email and verification code (OTP) are required' });
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const redisKey = `otp:${normalizedEmail}`;

    // Retrieve pending OTP from Redis
    const cachedData = await redisCache.get(redisKey);

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
        await redisCache.del(redisKey);
        res.status(400).json({ success: false, message: 'Too many invalid attempts. Code invalidated.' });
        return;
      }
      await redisCache.set(redisKey, JSON.stringify(parsed), 600);
      res.status(400).json({ success: false, message: 'Invalid verification code' });
      return;
    }

    // OTP Verified! Delete temporary code from Redis
    await redisCache.del(redisKey);

    // NOW save / update user directly in PostgreSQL via Prisma!
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          authProvider: 'EMAIL',
          isVerified: true,
        },
      });
    } else if (!user.isVerified) {
      user = await prisma.user.update({
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
  } catch (error: any) {
    console.error('[verifyOtp error]:', error);
    res.status(500).json({ success: false, message: 'Internal server error verifying OTP' });
  }
}

/**
 * Google Auth / OAuth Callback
 * Bypasses OTP flow — directly persists user to PostgreSQL DB automatically.
 */
export async function googleAuth(req: Request, res: Response): Promise<void> {
  try {
    const { credential, email, name, avatarUrl, googleId } = req.body;

    let userEmail = email;
    let userName = name;
    let userAvatar = avatarUrl;
    let gId = googleId;

    // Optional: Verify Google ID token if credential is provided
    if (credential) {
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
        });
        const payload = ticket.getPayload();
        if (payload) {
          userEmail = payload.email;
          userName = payload.name;
          userAvatar = payload.picture;
          gId = payload.sub;
        }
      } catch (tokenErr) {
        console.warn('⚠️ [Google Token Verify Warning]:', tokenErr);
      }
    }

    if (!userEmail) {
      res.status(400).json({ success: false, message: 'Email is required for Google Sign-In' });
      return;
    }

    const normalizedEmail = userEmail.toLowerCase().trim();

    // Directly save / upsert into PostgreSQL DB
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: userName || normalizedEmail.split('@')[0],
          avatarUrl: userAvatar,
          authProvider: 'GOOGLE',
          googleId: gId,
          isVerified: true,
        },
      });
    } else {
      user = await prisma.user.update({
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
  } catch (error: any) {
    console.error('[googleAuth error]:', error);
    res.status(500).json({ success: false, message: 'Internal server error processing Google Auth' });
  }
}

/**
 * Get current authenticated user details
 */
export async function getCurrentUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const user = await prisma.user.findUnique({
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
  } catch (error: any) {
    console.error('[getCurrentUser error]:', error);
    res.status(500).json({ success: false, message: 'Server error fetching user profile' });
  }
}

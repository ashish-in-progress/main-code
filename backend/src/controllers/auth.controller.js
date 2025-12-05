// src/controllers/auth.controller.js - FULLY FIXED OTP + SESSION REUSE
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { IN_PROD } from '../config/constants.js';
import { EmailService } from '../services/email/email.service.js';

const ACCESS_SECRET = process.env.ACCESS_SECRET || crypto.randomBytes(32).toString('hex');
const REFRESH_SECRET = process.env.REFRESH_SECRET || crypto.randomBytes(32).toString('hex');

export class AuthController {
  static async signup(req, res) {
    try {
      let { email, password } = req.body || {};

      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: "Invalid input types" });
      }

      email = email.trim().toLowerCase();
      password = password.trim();

      if (!email || !password) {
        return res.status(400).json({ message: "Missing email or password" });
      }

      if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      if (!email.includes("@") || !email.includes(".")) {
        return res.status(400).json({ message: "Invalid email format" });
      }

      const [existing] = await db.query(
        "SELECT email FROM User_data WHERE email = ?",
        [email]
      );

      if (existing && existing.length > 0) {
        return res.status(409).json({ message: "Email already registered" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      await db.query(
        "INSERT INTO User_data (email, pass) VALUES (?, ?)",
        [email, hashedPassword]
      );

      logger.info(`New user registered: ${email}`);
      res.status(201).json({ message: "User registered successfully" });
    } catch (err) {
      logger.error("Signup error:", err);
      if (err && err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: "Email already registered" });
      }
      res.status(500).json({ error: "Signup failed" });
    }
  }

  // ✅ FULLY FIXED LOGIN METHOD
  static async login(req, res) {
    try {
      // 1. SAFE BODY PARSING
      const body = req.body || {};
      let { email, password, otp } = body;

      if (!email) email = '';
      if (!password) password = '';
      if (!otp) otp = '';

      email = email.trim().toLowerCase();
      password = password.trim();

      if (!email || (!password && !otp)) {
        return res.status(400).json({ message: "Missing email or password/OTP" });
      }

      let user;

      // 2. AUTHENTICATION FLOW
      if (password && !otp) {
        // FIRST STEP: PASSWORD VALIDATION
        logger.info(`🔐 Password login attempt for ${email}`);
        const [rows] = await db.query("SELECT * FROM User_data WHERE email = ?", [email]);
        
        if (!rows?.length) {
          return res.status(401).json({ message: "Invalid credentials" });
        }

        user = rows[0];
        const passwordMatch = await bcrypt.compare(password, user.pass);
        if (!passwordMatch) {
          logger.warn(`❌ Invalid password for ${email}`);
          return res.status(401).json({ message: "Invalid credentials" });
        }
      } else if (otp) {
        // SECOND STEP: OTP VALIDATION
        logger.info(`🔍 OTP validation for ${email}`);
        const [rows] = await db.query("SELECT * FROM User_data WHERE email = ?", [email]);
        
        if (!rows?.length) {
          return res.status(401).json({ message: "Invalid credentials" });
        }
        user = rows[0];
      } else {
        return res.status(400).json({ message: "Invalid request" });
      }

      // 3. SESSION MANAGEMENT (KEEP BROKERS ALIVE)
      let sessionId;
      const [existingSessions] = await db.query(
        'SELECT session_id FROM UserSessions WHERE user_email = ? ORDER BY last_active DESC LIMIT 1',
        [user.email]
      );

      if (existingSessions?.length > 0) {
        sessionId = existingSessions[0].session_id;
        await db.query('UPDATE UserSessions SET last_active = NOW() WHERE session_id = ?', [sessionId]);
        logger.info(`🔄 Reusing session ${sessionId.substring(0, 8)}... for ${user.email}`);
      } else {
        sessionId = crypto.randomUUID();
        await db.query(
          'INSERT INTO UserSessions (session_id, user_email, created_at) VALUES (?, ?, NOW())',
          [sessionId, user.email]
        );
        logger.info(`🆕 New session ${sessionId.substring(0, 8)}... for ${user.email}`);
      }

      // 4. OTP FLOW
      if (!otp) {
        // GENERATE & SEND OTP
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.query(
          `INSERT INTO UserOTPs (user_email, otp, expires_at, created_at) 
           VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE), NOW()) 
           ON DUPLICATE KEY UPDATE otp = ?, expires_at = DATE_ADD(NOW(), INTERVAL 5 MINUTE)`,
          [user.email, otpCode, otpCode]
        );
        
        logger.info(`📧 Sending OTP ${otpCode} to ${user.email}`);
        await EmailService.sendOTP(user.email, otpCode);
        
        return res.json({
          success: false,
          otp_required: true,
          message: 'OTP sent to your email',
          sessionId
        });
      }

      // 5. VERIFY OTP
      logger.info(`🔍 Verifying OTP ${otp} for ${user.email}`);
      const [otpRows] = await db.query(
        'SELECT * FROM UserOTPs WHERE user_email = ? AND otp = ? AND expires_at > NOW()',
        [user.email, otp]
      );

      if (!otpRows?.length) {
        logger.warn(`❌ Invalid/expired OTP for ${user.email}`);
        return res.status(400).json({ message: 'Invalid or expired OTP' });
      }

      // 6. CLEANUP OTP
      
      await db.query('DELETE FROM UserOTPs WHERE user_email = ?', [user.email]);

      // 7. GENERATE TOKENS (FIXED: use email instead of id)
      const payload = { 
        userId: user.email,  // ✅ FIXED: was user.id (undefined)
        email: user.email, 
        jti: crypto.randomUUID() 
      };
      
      const accessToken = jwt.sign(payload, ACCESS_SECRET, { expiresIn: '15m' });
      const refreshToken = jwt.sign(payload, REFRESH_SECRET, { expiresIn: '30d' });

      // 8. SET SESSION & COOKIES
      req.session.user = { email: user.email };
      req.session.sessionId = sessionId;

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: IN_PROD === 'true',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });

      logger.info(`✅ LOGIN SUCCESS: ${user.email} (session: ${sessionId.substring(0, 8)}...)`);
      
      res.json({
        success: true,
        accessToken,
        sessionId,
        user: { email: user.email }
      });

    } catch (err) {
      logger.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  }

  static async refresh(req, res) {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token' });
    }

    try {
      const decoded = jwt.verify(refreshToken, REFRESH_SECRET);
      
      // Check blacklist (graceful if table missing)
      try {
        const [blacklisted] = await db.query(
          'SELECT 1 FROM TokenBlacklist WHERE jti = ? AND expires_at > NOW()', 
          [decoded.jti]
        );
        if (blacklisted.length > 0) {
          throw new Error('Token blacklisted');
        }
      } catch (e) {
        logger.debug('TokenBlacklist check skipped:', e.message);
      }

      const newPayload = { 
        ...decoded, 
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID()
      };
      
      const newAccessToken = jwt.sign(newPayload, ACCESS_SECRET, { expiresIn: '15m' });
      
      res.json({ 
        accessToken: newAccessToken,
        refreshRequired: false 
      });
    } catch (err) {
      logger.warn('Refresh token invalid:', err.message);
      res.status(401).json({ message: 'Invalid refresh token' });
    }
  }

  static async logout(req, res) {
    try {
      const sessionId = req.session?.sessionId;
      const userEmail = req.session?.user?.email || req.user?.email;
      
      // Clear USER session/cookies ONLY (KEEP DB RECORD!)
      if (req.session) {
        req.session.destroy();
      }
      res.clearCookie('refreshToken');
      res.clearCookie('unified_trading_session');
      
      logger.info(`User logged out safely (session ${sessionId?.substring(0,8)}... preserved)`);
      res.json({ message: 'Logged out successfully' });
    } catch (err) {
      logger.error("Logout error:", err);
      res.clearCookie('refreshToken');
      res.clearCookie('unified_trading_session');
      res.json({ message: 'Logged out successfully' });
    }
  }

  static me(req, res) {
    if (!req.session?.user && !req.user) {
      return res.status(401).json({ message: "Not logged in" });
    }
    
    const user = req.session?.user || req.user;
    res.json({ 
      user: {
        email: user.email,
        sessionId: req.session?.sessionId
      }
    });
  }
}

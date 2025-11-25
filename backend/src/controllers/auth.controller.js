// ==================== src/controllers/auth.controller.js ====================
import bcrypt from 'bcrypt';
import { db } from '../config/db.js';
import { logger } from '../utils/logger.js';

export class AuthController {
  static async signup(req, res) {
    try {
      let { email, password } = req.body;

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

      // Check if email already exists
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

  static async login(req, res) {
    try {
      let { email, password } = req.body;

      if (typeof email !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ message: "Invalid input types" });
      }

      email = email.trim().toLowerCase();
      password = password.trim();

      if (!email || !password) {
        return res.status(400).json({ message: "Missing email or password" });
      }

      const [rows] = await db.query(
        "SELECT email, pass FROM User_data WHERE email = ?",
        [email]
      );

      if (!rows || rows.length === 0) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const user = rows[0];
      const storedHash = user.pass;

      const passwordMatch = await bcrypt.compare(password, storedHash);

      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      req.session.user = { email: user.email };

      logger.info(`User logged in: ${user.email}`);

      res.json({ message: "Login successful", user: req.session.user });
    } catch (err) {
      logger.error("Login error:", err);
      res.status(500).json({ message: "Login failed" });
    }
  }

  static logout(req, res) {
    if (!req.session) {
      return res.json({ message: "Already logged out" });
    }

    const userEmail = req.session.user?.email;
    req.session.destroy(err => {
      if (err) {
        logger.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('unified_trading_session');
      if (userEmail) {
        logger.info(`User logged out: ${userEmail}`);
      }
      res.json({ message: "Logged out successfully" });
    });
  }

  static me(req, res) {
    if (!req.session.user) {
      return res.status(401).json({ message: "Not logged in" });
    }
    res.json({ user: req.session.user });
  }
}

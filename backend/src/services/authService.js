const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../config/database');

const JWT_SECRET = process.env.JWT_SECRET || 'ratescale-jwt-secret-key-2026-production';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'ratescale-refresh-secret-key-2026';

const registerSchema = z.object({
  email: z.string().email('Invalid email address format'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  fullName: z.string().min(2, 'Full name is required'),
});

class AuthService {
  async register({ email, password, fullName }) {
    // Validate inputs with Zod
    const parsed = registerSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      // Turn Zod's raw issue array into one clean, human-readable reason
      // instead of leaking the JSON error object to the client.
      const firstIssue = parsed.error.issues[0];
      const err = new Error(firstIssue.message);
      err.code = 'VALIDATION_ERROR';
      err.field = firstIssue.path[0];
      err.details = parsed.error.issues.map((i) => ({ field: i.path[0], reason: i.message }));
      throw err;
    }
    const validated = parsed.data;
    const cleanEmail = validated.email.toLowerCase();

    // Check duplicate email
    const existing = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);
    if (existing) {
      const err = new Error('An account with this email address already exists');
      err.code = 'DUPLICATE_EMAIL';
      err.field = 'email';
      throw err;
    }

    // Hash password with bcrypt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(validated.password, salt);

    const userId = `usr-${Date.now()}`;
    const createdAt = new Date().toISOString();

    db.run(
      'INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, cleanEmail, passwordHash, validated.fullName, 'Engineer', createdAt]
    );

    const user = {
      id: userId,
      email: cleanEmail,
      fullName: validated.fullName,
      role: 'Engineer',
      createdAt,
    };

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { user, token, refreshToken };
  }

  async login({ email, password }) {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    // Check if Demo Master Administrator login (flexible password matching for demo)
    if (cleanEmail === 'master@airatelimit.com') {
      if (
        cleanPass === 'MasterAdmin@2026!' ||
        cleanPass.toLowerCase() === 'masteradmin@2026!' ||
        cleanPass.toLowerCase() === 'masteradmin' ||
        cleanPass.toLowerCase() === 'admin'
      ) {
        let masterRecord = db.get('SELECT * FROM users WHERE email = ?', ['master@airatelimit.com']);
        if (!masterRecord) {
          const salt = bcrypt.genSaltSync(10);
          const hash = bcrypt.hashSync('MasterAdmin@2026!', salt);
          db.run(
            'INSERT INTO users (id, email, password_hash, full_name, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            ['usr-master-001', 'master@airatelimit.com', hash, 'Master Administrator', 'System Architect', new Date().toISOString()]
          );
          masterRecord = {
            id: 'usr-master-001',
            email: 'master@airatelimit.com',
            full_name: 'Master Administrator',
            role: 'System Architect',
            created_at: new Date().toISOString(),
          };
        }
        const user = {
          id: masterRecord.id,
          email: masterRecord.email,
          fullName: masterRecord.full_name || masterRecord.fullName || 'Master Administrator',
          role: masterRecord.role || 'System Architect',
          createdAt: masterRecord.created_at || masterRecord.createdAt || new Date().toISOString(),
        };
        const token = this.generateAccessToken(user);
        const refreshToken = this.generateRefreshToken(user);
        return { user, token, refreshToken };
      }
    }

    const userRecord = db.get('SELECT * FROM users WHERE email = ?', [cleanEmail]);

    if (!userRecord) {
      throw new Error('Account not found. Please register a new account or check your email.');
    }

    const isMatch = await bcrypt.compare(password, userRecord.password_hash);
    if (!isMatch) {
      throw new Error('Invalid email or password. Please check your credentials.');
    }

    const user = {
      id: userRecord.id,
      email: userRecord.email,
      fullName: userRecord.full_name || userRecord.fullName,
      role: userRecord.role,
      createdAt: userRecord.created_at || userRecord.createdAt,
    };

    const token = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Persist refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.run(
      'INSERT OR REPLACE INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)',
      [refreshToken, user.id, expiresAt]
    );

    return { user, token, refreshToken };
  }

  async logout(refreshToken) {
    if (refreshToken) {
      db.run('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]);
    }
    return { message: 'Logged out successfully' };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userRecord = db.get('SELECT id, email, full_name as fullName, role, created_at as createdAt FROM users WHERE id = ?', [decoded.id]);
      return userRecord || null;
    } catch (err) {
      return null;
    }
  }

  generateAccessToken(user) {
    return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });
  }

  generateRefreshToken(user) {
    return jwt.sign({ id: user.id, email: user.email, type: 'refresh' }, REFRESH_SECRET, { expiresIn: '7d' });
  }
}

module.exports = new AuthService();

// ==================== src/middleware/auth.js ====================

/**
 * Middleware to require authentication
 */
// Verify access token
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  
  try {
    req.user = jwt.verify(token, ACCESS_SECRET);
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired', refreshRequired: true });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
}

// Broker auth: JWT + sessionId validation
export function requireBrokerAuth(broker) {
  return [requireAuth, async (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(401).json({ error: 'No session ID' });
    
    const session = await db.query(
      'SELECT * FROM UserSessions WHERE session_id = ? AND user_email = ?', 
      [sessionId, req.user.email]
    );
    if (!session.length) return res.status(401).json({ error: 'Invalid session' });
    
    req.sessionId = sessionId;
    next();
  }];
}



/**
 * Optional: Middleware to log requests
 */
export function logRequest(req, res, next) {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
}
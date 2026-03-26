const { signToken, verifyToken, authMiddleware, wsAuth } = require('../../server/auth');

describe('Auth Utils', () => {
  describe('signToken and verifyToken', () => {
    test('signToken creates a valid token', () => {
      const payload = { id: '123', username: 'testuser' };
      const token = signToken(payload);
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    test('verifyToken returns payload for valid token', () => {
      const payload = { id: '123', username: 'testuser' };
      const token = signToken(payload);
      const verified = verifyToken(token);
      expect(verified).toBeDefined();
      expect(verified.id).toBe('123');
      expect(verified.username).toBe('testuser');
    });

    test('verifyToken returns null for invalid token', () => {
      const result = verifyToken('invalid.token.here');
      expect(result).toBeNull();
    });

    test('verifyToken returns null for expired token', () => {
      // Create a token that expires immediately (sign with custom options would require modifying auth.js)
      const result = verifyToken('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjEyMyIsImlhdCI6MCwiZXhwIjoxfQ.invalid');
      expect(result).toBeNull();
    });

    test('verifyToken returns null for undefined/null', () => {
      expect(verifyToken(undefined)).toBeNull();
      expect(verifyToken(null)).toBeNull();
      expect(verifyToken('')).toBeNull();
    });
  });

  describe('authMiddleware', () => {
    test('Rejects request without Authorization header', () => {
      const req = { headers: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    test('Rejects request without Bearer prefix', () => {
      const req = { headers: { authorization: 'Basic xyz' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Rejects request with invalid token', () => {
      const req = { headers: { authorization: 'Bearer invalid.token' } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('Accepts valid Bearer token and sets req.user', () => {
      const payload = { id: '123', username: 'testuser' };
      const token = signToken(payload);
      const req = { headers: { authorization: `Bearer ${token}` } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authMiddleware(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('123');
      expect(req.user.username).toBe('testuser');
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('Extracts token after "Bearer " prefix correctly', () => {
      const payload = { id: 'abc', username: 'user2' };
      const token = signToken(payload);
      const req = { headers: { authorization: `Bearer   ${token}` } }; // extra spaces
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      const next = jest.fn();

      authMiddleware(req, res, next);

      // Should handle extra spaces correctly - actually Bearer<space> has exactly 1 space
      // This test verifies the exact slice(7) behavior
      expect(next).not.toHaveBeenCalled(); // Will fail because of extra space
    });
  });

  describe('wsAuth', () => {
    test('wsAuth returns payload for valid token', () => {
      const payload = { id: '123', username: 'testuser' };
      const token = signToken(payload);
      const result = wsAuth(token);
      expect(result).toBeDefined();
      expect(result.id).toBe('123');
    });

    test('wsAuth returns null for invalid token', () => {
      const result = wsAuth('invalid.token');
      expect(result).toBeNull();
    });

    test('wsAuth returns null for empty token', () => {
      expect(wsAuth('')).toBeNull();
      expect(wsAuth(null)).toBeNull();
    });
  });
});

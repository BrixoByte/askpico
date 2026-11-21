// Request-level guards mounted in server.js. Kept in their own module so tests can run them
// on a real Express app without importing server.js (which starts listening on import).

// Every API body is JSON. Reject any other body type before auth runs, so a malformed
// request gets 415 instead of a sign-in error.
export const requireJsonBody = (req, res, next) => {
  const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding'] !== undefined;
  if (!['POST', 'PUT', 'PATCH'].includes(req.method) || !hasBody || req.is('application/json')) return next();
  return res.status(415).json({ error: 'Request body must be application/json' });
};

// JSON 404 for unknown API routes. Does not echo the requested path.
export const apiNotFound = (_req, res) => res.status(404).json({ error: 'Not found' });

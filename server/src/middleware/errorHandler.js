export function errorHandler(err, _req, res, _next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }

  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate entry' });
  }

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: err.message });
  }

  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
}

import type { Request, Response, NextFunction } from 'express';
import { config } from './config';

export function adminGuard(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.status(401).json({
      status: 'invalid',
      error: 'Admin authentication required. Use Basic auth.',
    });
    return;
  }

  const base64 = authHeader.slice(6);
  let decoded: string;

  try {
    decoded = Buffer.from(base64, 'base64').toString('utf-8');
  } catch {
    res.status(401).json({ status: 'invalid', error: 'Malformed Authorization header.' });
    return;
  }

  const colonIdx = decoded.indexOf(':');
  if (colonIdx === -1) {
    res.status(401).json({ status: 'invalid', error: 'Malformed Basic auth credentials.' });
    return;
  }

  const user = decoded.slice(0, colonIdx);
  const password = decoded.slice(colonIdx + 1);

  if (user !== config.admin.user || password !== config.admin.password) {
    res.status(403).json({ status: 'invalid', error: 'Invalid admin credentials.' });
    return;
  }

  next();
}

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { config } from './config';
import { sessionStore } from './stores/sessionStore';
import metaRouter from './routes/meta';

const app = express();

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// API routes (mount order matters — static SPA catch-all comes last)
// ---------------------------------------------------------------------------
app.use('/api', metaRouter);

// Route placeholders will be mounted here as each UC is implemented:
// app.use('/api', bookRouter);
// app.use('/api', usageRouter);
// app.use('/api', planChangeRouter);
// app.use('/api', lifecycleRouter);
// app.use('/api', invoicesRouter);
// app.use('/api', digestRouter);

// ---------------------------------------------------------------------------
// Serve the built React SPA in production
// ---------------------------------------------------------------------------
if (process.env.NODE_ENV === 'production') {
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const ttlMs = config.sessionTtlMinutes * 60 * 1000;
sessionStore.startSweep(ttlMs);

const server = app.listen(config.port, () => {
  console.log(`[metermate] Server on http://localhost:${config.port}`);
  console.log(`[metermate] Maxio site  : ${config.maxio.siteSubdomain || '(not configured)'}`);
  console.log(`[metermate] Slack bot   : ${config.slack.botToken ? 'configured' : '(not configured)'}`);
  console.log(`[metermate] Session TTL : ${config.sessionTtlMinutes}m`);
});

process.on('SIGTERM', () => {
  console.log('[metermate] SIGTERM received — shutting down');
  sessionStore.stopSweep();
  server.close();
});

export { app };

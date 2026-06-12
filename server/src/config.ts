import type { Consultant } from './types';

function env(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: parseInt(env('PORT', '4000'), 10),
  sessionTtlMinutes: parseInt(env('SESSION_TTL_MINUTES', '30'), 10),
  demoMode: env('DEMO_MODE', 'true') === 'true',
  digestCron: env('DIGEST_CRON', '0 9 * * 1'),

  maxio: {
    apiKey: env('MAXIO_API_KEY'),
    siteSubdomain: env('MAXIO_SITE_SUBDOMAIN'),
    environment: env('MAXIO_ENVIRONMENT', 'US') as 'US' | 'EU',
    defaultProductFamily: env('MAXIO_DEFAULT_PRODUCT_FAMILY', 'metermate'),
    apiCallsMetricId: parseInt(env('MAXIO_API_CALLS_METRIC_ID', '0'), 10),
  },

  slack: {
    botToken: env('SLACK_BOT_TOKEN'),
    clientId: env('SLACK_CLIENT_ID'),
    clientSecret: env('SLACK_CLIENT_SECRET'),
    digestChannel: env('SLACK_DIGEST_CHANNEL'),
  },

  admin: {
    user: env('ADMIN_USER', 'admin'),
    password: env('ADMIN_PASSWORD', 'changeme'),
  },
} as const;

export const CONSULTANTS: Consultant[] = [
  { id: 'c1', name: 'Alice Nguyen', email: 'alice@metermate.dev' },
  { id: 'c2', name: 'Bob Patel', email: 'bob@metermate.dev' },
];

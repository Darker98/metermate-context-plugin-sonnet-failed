import { Client, Environment } from '@maxio-com/advanced-billing-sdk';
import { config } from './config';

let _client: Client | null = null;

export function getMaxioClient(): Client {
  if (!_client) {
    _client = new Client({
      basicAuthCredentials: {
        username: config.maxio.apiKey,
        password: 'x',
      },
      timeout: 60_000,
      environment: Environment.US,
      site: config.maxio.siteSubdomain,
    });
  }
  return _client;
}

import { Client, Environment, LogLevel, OauthScope } from 'slack-apimatic-sdk';
import { config } from './config';

let _client: Client | null = null;

export function getSlackClient(): Client {
  if (!_client) {
    _client = new Client({
      authorizationCodeAuthCredentials: {
        oauthClientId: config.slack.clientId || 'placeholder-not-used',
        oauthClientSecret: config.slack.clientSecret || 'placeholder-not-used',
        oauthRedirectUri: `http://localhost:${config.port}/oauth/callback`,
        oauthScopes: [
          OauthScope.Chatwritebot,
          OauthScope.Channelswrite,
          OauthScope.Groupswrite,
          OauthScope.Imwrite,
          OauthScope.Mpimwrite,
          OauthScope.UsersreadEmail,
        ],
      },
      timeout: 30_000,
      environment: Environment.Production,
      logging: {
        logLevel: LogLevel.Warn,
        logRequest: { logBody: false },
        logResponse: { logHeaders: false },
      },
    });
  }
  return _client;
}

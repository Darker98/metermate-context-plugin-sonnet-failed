import {
  ApiError,
  AuthApi,
  ChatApi,
  ConversationsApi,
  UsersApi,
} from 'slack-apimatic-sdk';
import { getSlackClient } from '../slackClient';
import { transactionStore } from '../stores/transactionStore';
import { config } from '../config';
import type { BlockKitBlock, Transaction } from '../types';

// ---------------------------------------------------------------------------
// Internal API instance factory
// ---------------------------------------------------------------------------

function getApis() {
  const client = getSlackClient();
  return {
    auth: new AuthApi(client),
    chat: new ChatApi(client),
    conversations: new ConversationsApi(client),
    users: new UsersApi(client),
  };
}

function tok(): string {
  return config.slack.botToken;
}

// ---------------------------------------------------------------------------
// Channel naming helpers
// ---------------------------------------------------------------------------

function sanitizeSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 21);
}

function buildChannelName(consultantId: string, clientEmail: string, seq: number): string {
  const cSlug = sanitizeSlug(consultantId);
  const eSlug = sanitizeSlug(clientEmail.split('@')[0]);
  const seqStr = String(seq).padStart(3, '0');
  return `txn-${cSlug}-${eSlug}-${seqStr}`.substring(0, 80);
}

// ---------------------------------------------------------------------------
// ensureTxnChannel — the core channel management function
// ---------------------------------------------------------------------------

export interface EnsureTxnChannelResult {
  channelId: string;
  channelName: string;
  created: boolean;
}

export async function ensureTxnChannel(txn: Transaction): Promise<EnsureTxnChannelResult> {
  const { conversations, users } = getApis();
  const token = tok();

  // 1. If this transaction already has a channel, return it
  if (txn.channelId && txn.channelName) {
    return { channelId: txn.channelId, channelName: txn.channelName, created: false };
  }

  // 2. If a prior transaction for this consultant↔client pair already opened a channel, reuse it
  const existingChannel = transactionStore.getChannelForPair(txn.consultantId, txn.clientEmail);
  if (existingChannel) {
    transactionStore.setChannel(txn.txnId, existingChannel.channelId, existingChannel.channelName);
    return { ...existingChannel, created: false };
  }

  // 3. Create a new private channel
  const seq = transactionStore.nextChannelSeq();
  const channelName = buildChannelName(txn.consultantId, txn.clientEmail, seq);

  let channelId: string;
  let finalChannelName: string;

  try {
    const createResp = await conversations.conversationsCreate(token, channelName, true);
    if (!createResp.result) throw new Error('conversations.create returned no result');
    const channelObj = createResp.result.channel as { id?: string; name?: string } | undefined;
    if (!channelObj?.id) throw new Error('conversations.create returned no channel id');
    channelId = channelObj.id;
    finalChannelName = channelObj.name ?? channelName;
  } catch (err) {
    if (err instanceof ApiError) {
      const bodyStr = typeof err.body === 'string' ? err.body : JSON.stringify(err.body);
      if (bodyStr.includes('name_taken')) {
        // Race condition or duplicate: check if the store has it now
        const raceChannel = transactionStore.getChannelForPair(txn.consultantId, txn.clientEmail);
        if (raceChannel) {
          transactionStore.setChannel(txn.txnId, raceChannel.channelId, raceChannel.channelName);
          return { ...raceChannel, created: false };
        }
      }
    }
    throw err;
  }

  // 4. Set channel topic (non-critical)
  try {
    await conversations.conversationsSetTopic(
      token,
      channelId,
      `MeterMate | ${txn.type} | Consultant: ${txn.consultantId} | Client: ${txn.clientEmail}`,
    );
  } catch (topicErr) {
    console.warn('[slackService] Failed to set channel topic:', errMsg(topicErr));
  }

  // 5. Invite parties — two-tier strategy
  const consultantInvited = await tryInviteByEmail(token, channelId, txn.consultantId, users, conversations);
  const clientInvited = await tryInviteByEmail(token, channelId, txn.clientEmail, users, conversations);

  // 6. Post "channel opened" message (non-critical)
  try {
    const blocks = buildChannelOpenedBlocks(txn, consultantInvited, clientInvited);
    await postBlocks(channelId, blocks, `MeterMate: ${txn.type} transaction started`);
  } catch (postErr) {
    console.warn('[slackService] Failed to post channel-opened message:', errMsg(postErr));
  }

  // 7. Persist to store
  transactionStore.setChannel(txn.txnId, channelId, finalChannelName);

  return { channelId, channelName: finalChannelName, created: true };
}

// ---------------------------------------------------------------------------
// Two-tier invite helper
// ---------------------------------------------------------------------------

async function tryInviteByEmail(
  token: string,
  channelId: string,
  email: string,
  usersApi: UsersApi,
  conversationsApi: ConversationsApi,
): Promise<boolean> {
  try {
    // Tier 1: look up user by email in the workspace
    const lookupResp = await usersApi.usersLookupByEmail(token, email);
    if (!lookupResp.result) return false;

    const userObj = lookupResp.result.user as { id?: string } | undefined;
    if (!userObj?.id) return false;

    await conversationsApi.conversationsInvite(token, channelId, userObj.id);
    return true;
  } catch (err) {
    // Tier 2: user is not a workspace member or invite failed — log and fall through
    console.warn(`[slackService] Could not invite ${email} to ${channelId}: ${errMsg(err)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Message posting
// ---------------------------------------------------------------------------

async function postBlocks(
  channelId: string,
  blocks: BlockKitBlock[],
  fallbackText: string,
): Promise<void> {
  const { chat } = getApis();
  const token = tok();
  await chat.chatPostMessage(
    token,
    channelId,
    undefined,              // asUser
    undefined,              // attachments
    JSON.stringify(blocks), // blocks (JSON-encoded)
    undefined,              // iconEmoji
    undefined,              // iconUrl
    undefined,              // linkNames
    undefined,              // mrkdwn
    undefined,              // parse
    undefined,              // replyBroadcast
    fallbackText,           // text (fallback)
  );
}

export async function postProgress(
  channelId: string,
  blocks: BlockKitBlock[],
  fallbackText: string,
): Promise<void> {
  try {
    await postBlocks(channelId, blocks, fallbackText);
  } catch (err) {
    // Slack failures never block billing operations
    console.warn('[slackService] postProgress failed:', errMsg(err));
  }
}

export async function postCompletion(
  channelId: string,
  blocks: BlockKitBlock[],
  fallbackText: string,
): Promise<void> {
  try {
    await postBlocks(channelId, blocks, fallbackText);
  } catch (err) {
    console.warn('[slackService] postCompletion failed:', errMsg(err));
  }
}

export async function postFailure(
  channelId: string,
  blocks: BlockKitBlock[],
  fallbackText: string,
): Promise<void> {
  try {
    await postBlocks(channelId, blocks, fallbackText);
  } catch (err) {
    console.warn('[slackService] postFailure failed:', errMsg(err));
  }
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface SlackAuthStatus {
  ok: boolean;
  botId?: string;
  team?: string;
}

export async function verifySlackAuth(): Promise<SlackAuthStatus> {
  if (!config.slack.botToken) return { ok: false };
  try {
    const { auth } = getApis();
    const resp = await auth.authTest(config.slack.botToken);
    if (!resp.result) return { ok: false };
    return {
      ok: resp.result.ok === 'true' || (resp.result.ok as unknown) === true,
      botId: resp.result.botId as string | undefined,
      team: resp.result.team as string | undefined,
    };
  } catch {
    return { ok: false };
  }
}

// ---------------------------------------------------------------------------
// Block Kit builders — pure functions, no Slack I/O
// ---------------------------------------------------------------------------

function headerBlock(text: string): BlockKitBlock {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } };
}

function divider(): BlockKitBlock {
  return { type: 'divider' };
}

function context(text: string): BlockKitBlock {
  return { type: 'context', elements: [{ type: 'mrkdwn', text }] };
}

function fields(items: Array<{ label: string; value: string }>): BlockKitBlock {
  return {
    type: 'section',
    fields: items.map(i => ({ type: 'mrkdwn', text: `*${i.label}*\n${i.value}` })),
  };
}

function markdownSection(text: string): BlockKitBlock {
  return { type: 'section', text: { type: 'mrkdwn', text } };
}

function button(label: string, url: string): BlockKitBlock {
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: label, emoji: true },
        url,
        style: 'primary',
      },
    ],
  };
}

function timestamp(): string {
  return `_MeterMate · ${new Date().toUTCString()}_`;
}

export function buildChannelOpenedBlocks(
  txn: Transaction,
  consultantInvited: boolean,
  clientInvited: boolean,
): BlockKitBlock[] {
  const blocks: BlockKitBlock[] = [
    headerBlock(':wave: Transaction started'),
    divider(),
    fields([
      { label: 'Transaction ID', value: txn.txnId },
      { label: 'Type', value: txn.type },
      { label: 'Consultant', value: txn.consultantId },
      { label: 'Client', value: txn.clientEmail },
    ]),
  ];

  const notes: string[] = [];
  if (!consultantInvited) notes.push('Consultant notified by email (not a workspace member).');
  if (!clientInvited) notes.push('Client notified by email (not a workspace member).');
  if (notes.length > 0) {
    blocks.push(context(`:information_source: ${notes.join('  ')}`));
  }

  blocks.push(context(timestamp()));
  return blocks;
}

export function buildProgressBlocks(
  header: string,
  fieldItems: Array<{ label: string; value: string }>,
): BlockKitBlock[] {
  return [
    headerBlock(header),
    divider(),
    ...(fieldItems.length > 0 ? [fields(fieldItems)] : []),
    context(timestamp()),
  ];
}

export function buildCompletionBlocks(
  header: string,
  fieldItems: Array<{ label: string; value: string }>,
  buttonLabel?: string,
  buttonUrl?: string,
): BlockKitBlock[] {
  const blocks: BlockKitBlock[] = [
    headerBlock(header),
    divider(),
    ...(fieldItems.length > 0 ? [fields(fieldItems)] : []),
    context(timestamp()),
  ];
  if (buttonLabel && buttonUrl) {
    blocks.push(button(buttonLabel, buttonUrl));
  }
  return blocks;
}

export function buildFailureBlocks(ucName: string, errorSummary: string): BlockKitBlock[] {
  return [
    headerBlock(`:warning: ${ucName} failed`),
    divider(),
    markdownSection(`*Error:* ${errorSummary}`),
    context(timestamp()),
  ];
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err instanceof ApiError) return `HTTP ${err.statusCode}: ${JSON.stringify(err.body)}`;
  return String(err);
}

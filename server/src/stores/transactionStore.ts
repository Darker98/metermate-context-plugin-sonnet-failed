import type { Transaction } from '../types';

const txnMap = new Map<string, Transaction>();

interface ChannelRecord {
  channelId: string;
  channelName: string;
}

const channelPairMap = new Map<string, ChannelRecord>();
let channelSequence = 0;

function pairKey(consultantId: string, clientEmail: string): string {
  return `${consultantId}:${clientEmail.toLowerCase()}`;
}

export const transactionStore = {
  get(txnId: string): Transaction | undefined {
    return txnMap.get(txnId);
  },

  put(txn: Transaction): void {
    txnMap.set(txn.txnId, { ...txn, updatedAt: Date.now() });
  },

  updateState(txnId: string, state: Transaction['state']): Transaction | undefined {
    const txn = txnMap.get(txnId);
    if (!txn) return undefined;
    const updated: Transaction = { ...txn, state, updatedAt: Date.now() };
    txnMap.set(txnId, updated);
    return updated;
  },

  setChannel(txnId: string, channelId: string, channelName: string): Transaction | undefined {
    const txn = txnMap.get(txnId);
    if (!txn) return undefined;
    const updated: Transaction = { ...txn, channelId, channelName, updatedAt: Date.now() };
    txnMap.set(txnId, updated);
    channelPairMap.set(pairKey(txn.consultantId, txn.clientEmail), { channelId, channelName });
    return updated;
  },

  setSubscriptionId(txnId: string, subscriptionId: number): Transaction | undefined {
    const txn = txnMap.get(txnId);
    if (!txn) return undefined;
    const updated: Transaction = { ...txn, subscriptionId, updatedAt: Date.now() };
    txnMap.set(txnId, updated);
    return updated;
  },

  getChannelForPair(consultantId: string, clientEmail: string): ChannelRecord | undefined {
    return channelPairMap.get(pairKey(consultantId, clientEmail));
  },

  findByRef(txnRef: string): Transaction | undefined {
    return txnMap.get(txnRef);
  },

  size(): number {
    return txnMap.size;
  },

  nextChannelSeq(): number {
    return ++channelSequence;
  },

  delete(txnId: string): void {
    const txn = txnMap.get(txnId);
    if (txn) {
      channelPairMap.delete(pairKey(txn.consultantId, txn.clientEmail));
      txnMap.delete(txnId);
    }
  },
};

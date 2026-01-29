import { v4 as uuidv4 } from 'uuid';
import { apiRequest } from './api';

export type OfflineQueueItem = {
  id: string;
  method: 'PATCH' | 'POST' | 'DELETE';
  endpoint: string;
  payload?: any;
  timestamp: number;
  attempts: number;
  itemId?: string;
};

export type OfflineOperation = {
  method: 'PATCH' | 'POST' | 'DELETE';
  endpoint: string;
  payload?: any;
  itemId?: string;
};

function shouldCoalescePatch(payload: any): boolean {
  if (!payload) return false;
  const hasContent = !!payload.content;
  const hasFavorite = Object.prototype.hasOwnProperty.call(payload, 'isFavorite');
  const hasPinned = Object.prototype.hasOwnProperty.call(payload, 'isPinned');
  const hasTags = Object.prototype.hasOwnProperty.call(payload, 'tags');
  const hasRename = Object.prototype.hasOwnProperty.call(payload, 'title') || Object.prototype.hasOwnProperty.call(payload, 'name');
  const hasMove = Object.prototype.hasOwnProperty.call(payload, 'parentId') || Object.prototype.hasOwnProperty.call(payload, 'folderId');
  return hasContent || hasFavorite || hasPinned || hasTags || hasRename || hasMove;
}

export function enqueueOffline(queue: OfflineQueueItem[], op: OfflineOperation): OfflineQueueItem[] {
  const item: OfflineQueueItem = {
    id: uuidv4(),
    method: op.method,
    endpoint: op.endpoint,
    payload: op.payload,
    itemId: op.itemId,
    timestamp: Date.now(),
    attempts: 0,
  };

  let q = [...(queue || [])];
  if (item.method === 'PATCH' && item.itemId && shouldCoalescePatch(item.payload)) {
    q = q.filter(i => !(i.method === 'PATCH' && i.itemId === item.itemId && i.endpoint === item.endpoint));
  }
  const newQueue = [...q, item];
  return newQueue;
}

export async function processOfflineQueue(
  queue: OfflineQueueItem[],
  opts: {
    isAuthenticated: boolean;
    isOfflineMode: boolean;
    onUnauthorized: () => void;
  }
): Promise<OfflineQueueItem[]> {
  if (!opts.isAuthenticated || opts.isOfflineMode) return queue || [];
  const snapshot = [...(queue || [])];
  if (snapshot.length === 0) return snapshot;

  const newQueue: OfflineQueueItem[] = [];
  for (const op of snapshot) {
    try {
      await apiRequest(op.method, op.endpoint, op.payload);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (msg.includes('401')) {
        opts.onUnauthorized();
        break;
      }
      const nextAttempts = (op.attempts || 0) + 1;
      if (nextAttempts < 5) {
        newQueue.push({ ...op, attempts: nextAttempts });
      }
    }
  }
  return newQueue;
}
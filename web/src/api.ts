import { getSessionId } from './session';

const API_BASE = '/api';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  const data: unknown = await resp.json();
  if (!resp.ok) throw new ApiError(resp.status, data, `Request to ${path} failed: ${resp.status}`);
  return data as T;
}

export function get<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify({ ...body, sessionId: getSessionId() }),
  });
}

export interface HealthResponse {
  status: string;
  sessions: number;
  transactions: number;
  maxioSite: string | null;
  slackOk: boolean;
  productsCached: number;
}

export interface ProductEntry {
  handle: string;
  name: string;
  priceInCents: number;
  intervalUnit: string;
}

export interface Consultant {
  id: string;
  name: string;
  email: string;
}

export const api = {
  health: () => get<HealthResponse>('/health'),
  products: () => get<ProductEntry[]>('/products'),
  consultants: () => get<Consultant[]>('/consultants'),
};

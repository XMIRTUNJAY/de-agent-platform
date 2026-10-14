import type { AnalyticsEvent } from './client.js';

export interface NodeAnalyticsConfig {
  endpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
}

export class NodeAnalyticsClient {
  private queue: AnalyticsEvent[] = [];
  private config: Required<NodeAnalyticsConfig>;
  private flushTimer: NodeJS.Timeout | null = null;
  private sessionId: string;

  constructor(config: NodeAnalyticsConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey ?? '',
      batchSize: config.batchSize ?? 50,
      flushInterval: config.flushInterval ?? 10000,
      debug: config.debug ?? false,
    };
    this.sessionId = crypto.randomUUID();
    this.startFlushTimer();
  }

  track(
    event: string,
    properties: Record<string, unknown>,
    overrides: Partial<AnalyticsEvent> = {}
  ): void {
    const fullEvent: AnalyticsEvent = {
      event,
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
      properties,
      ...overrides,
    };

    this.queue.push(fullEvent);
    if (this.queue.length >= this.config.batchSize) this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, this.config.batchSize);
    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({ events, version: '1.0.0' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (this.config.debug) console.log('[Analytics] Flushed', events.length, 'events');
    } catch (err) {
      if (this.config.debug) console.error('[Analytics] Flush failed:', err);
      this.queue.unshift(...events);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
    this.flushTimer.unref?.();
  }

  async shutdown(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}

let nodeClient: NodeAnalyticsClient | null = null;

export function initNodeAnalytics(config: NodeAnalyticsConfig): NodeAnalyticsClient {
  if (nodeClient) {
    console.warn('[Analytics] Already initialized');
    return nodeClient;
  }
  nodeClient = new NodeAnalyticsClient(config);
  process.on('beforeExit', () => nodeClient?.shutdown());
  process.on('SIGINT', () => nodeClient?.shutdown());
  process.on('SIGTERM', () => nodeClient?.shutdown());
  return nodeClient;
}

export function getNodeAnalytics(): NodeAnalyticsClient | null {
  return nodeClient;
}

export function trackNode(
  event: string,
  properties: Record<string, unknown>,
  overrides?: Partial<AnalyticsEvent>
): void {
  nodeClient?.track(event, properties, overrides);
}
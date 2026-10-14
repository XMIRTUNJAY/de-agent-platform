export interface AnalyticsConfig {
  endpoint: string;
  apiKey?: string;
  batchSize?: number;
  flushInterval?: number;
  debug?: boolean;
  beforeSend?: (event: AnalyticsEvent) => AnalyticsEvent | false;
}

export interface AnalyticsEvent {
  event: string;
  timestamp: string;
  session_id?: string;
  user_id?: string;
  workspace_id?: string;
  anonymous_id?: string;
  page?: {
    path: string;
    referrer?: string;
    title?: string;
  };
  context?: {
    user_agent?: string;
    locale?: string;
    timezone?: string;
    screen_width?: number;
    screen_height?: number;
  };
  properties: Record<string, unknown>;
}

export class AnalyticsClient {
  private queue: AnalyticsEvent[] = [];
  private config: Required<AnalyticsConfig>;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;
  private anonymousId: string;
  private userId?: string;
  private workspaceId?: string;
  private isBrowser: boolean;

  constructor(config: AnalyticsConfig) {
    this.config = {
      endpoint: config.endpoint,
      apiKey: config.apiKey ?? '',
      batchSize: config.batchSize ?? 10,
      flushInterval: config.flushInterval ?? 5000,
      debug: config.debug ?? false,
      beforeSend: config.beforeSend ?? (e => e),
    };
    this.isBrowser = typeof window !== 'undefined';
    this.sessionId = this.getOrCreateSessionId();
    this.anonymousId = this.getOrCreateAnonymousId();
    this.startFlushTimer();
  }

  private getOrCreateSessionId(): string {
    if (this.isBrowser) {
      let id = sessionStorage.getItem('de_agent_session_id');
      if (!id) {
        id = crypto.randomUUID();
        sessionStorage.setItem('de_agent_session_id', id);
      }
      return id;
    }
    return crypto.randomUUID();
  }

  private getOrCreateAnonymousId(): string {
    if (this.isBrowser) {
      let id = localStorage.getItem('de_agent_anonymous_id');
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('de_agent_anonymous_id', id);
      }
      return id;
    }
    return crypto.randomUUID();
  }

  setUser(userId: string, workspaceId?: string): void {
    this.userId = userId;
    this.workspaceId = workspaceId;
  }

  clearUser(): void {
    this.userId = undefined;
    this.workspaceId = undefined;
  }

  private getBaseEvent(): Partial<AnalyticsEvent> {
    const base: Partial<AnalyticsEvent> = {
      session_id: this.sessionId,
      anonymous_id: this.anonymousId,
    };
    if (this.userId) base.user_id = this.userId;
    if (this.workspaceId) base.workspace_id = this.workspaceId;
    if (this.isBrowser) {
      base.context = {
        user_agent: navigator.userAgent,
        locale: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen_width: screen.width,
        screen_height: screen.height,
      };
      base.page = {
        path: window.location.pathname,
        referrer: document.referrer || undefined,
        title: document.title,
      };
    }
    return base;
  }

  track(
    event: string,
    properties: Record<string, unknown>
  ): void {
    const base = this.getBaseEvent();
    const fullEvent = {
      ...base,
      event,
      timestamp: new Date().toISOString(),
      properties,
    } as AnalyticsEvent;

    const processed = this.config.beforeSend(fullEvent);
    if (processed === false) return;

    this.queue.push(processed);
    if (this.queue.length >= this.config.batchSize) this.flush();
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const events = this.queue.splice(0, this.config.batchSize);
    try {
      await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
        },
        body: JSON.stringify({ events, version: '1.0.0' }),
        keepalive: true,
      });
      if (this.config.debug) console.log('[Analytics] Flushed', events.length, 'events');
    } catch (err) {
      if (this.config.debug) console.error('[Analytics] Flush failed:', err);
      this.queue.unshift(...events);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => this.flush(), this.config.flushInterval);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.flush();
  }
}

let browserClient: AnalyticsClient | null = null;

export function initAnalytics(config: AnalyticsConfig): AnalyticsClient {
  if (typeof window !== 'undefined' && browserClient) {
    console.warn('[Analytics] Already initialized');
    return browserClient;
  }
  browserClient = new AnalyticsClient(config);
  if (typeof window !== 'undefined') {
    (window as any).__DE_AGENT_ANALYTICS__ = browserClient;
    window.addEventListener('beforeunload', () => browserClient?.destroy());
  }
  return browserClient;
}

export function getAnalytics(): AnalyticsClient | null {
  return browserClient;
}

export function track(
  event: string,
  properties: Record<string, unknown>
): void {
  browserClient?.track(event, properties);
}

export function setUser(userId: string, workspaceId?: string): void {
  browserClient?.setUser(userId, workspaceId);
}

export function clearUser(): void {
  browserClient?.clearUser();
}
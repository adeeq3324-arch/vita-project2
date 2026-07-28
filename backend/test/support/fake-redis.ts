/**
 * An in-memory stand-in for the shared ioredis client.
 *
 * Implements only the commands this application actually issues, with the same
 * semantics — including expiry, which several behaviours depend on. Time is read
 * through `Date.now()` so a test can drive expiry with fake timers instead of
 * sleeping.
 *
 * **What this does and does not prove.** The rate limiter's counting logic lives
 * in a Lua script that runs inside Redis; `vitalThrottle` below is a faithful
 * port of it, which is what lets the e2e suite exercise the guards over real
 * HTTP without a Redis to hand. A port can drift from its original, so the
 * script itself is additionally executed against a real Redis by
 * `test/redis-throttle.integration-spec.ts`, which CI runs with a Redis service.
 * The two together cover both the wiring and the script.
 */
interface Entry {
  value: string;
  /** Epoch milliseconds, or null when the key does not expire. */
  expiresAt: number | null;
}

export class FakeRedis {
  private readonly store = new Map<string, Entry>();

  /** Commands registered through `defineCommand`, by name. */
  private readonly scripts = new Set<string>();

  // ── lifecycle ─────────────────────────────────────────────────────────────

  async ping(): Promise<string> {
    return 'PONG';
  }

  async quit(): Promise<string> {
    this.store.clear();
    return 'OK';
  }

  on(): this {
    return this;
  }

  /** Empties the keyspace between tests. */
  flushall(): void {
    this.store.clear();
  }

  // ── string commands ───────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    return this.read(key)?.value ?? null;
  }

  async set(key: string, value: string, mode?: string, ttl?: number): Promise<'OK'> {
    let expiresAt: number | null = null;
    if (mode?.toUpperCase() === 'EX' && ttl !== undefined) {
      expiresAt = Date.now() + ttl * 1000;
    }
    if (mode?.toUpperCase() === 'PX' && ttl !== undefined) {
      expiresAt = Date.now() + ttl;
    }

    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let removed = 0;
    for (const key of keys) {
      if (this.store.delete(key)) {
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Cursor-based iteration. The whole keyspace is returned in one pass — the
   * contract only requires that a full sweep visits every key, and callers
   * already loop until the cursor comes back as '0'.
   */
  async scan(
    _cursor: string,
    _matchToken: string,
    pattern: string,
    _countToken: string,
    _count: number,
  ): Promise<[string, string[]]> {
    const prefix = pattern.replace(/\*$/, '');
    const keys = [...this.store.keys()].filter(
      (key) => this.read(key) !== null && key.startsWith(prefix),
    );
    return ['0', keys];
  }

  // ── script support ────────────────────────────────────────────────────────

  defineCommand(name: string, _definition: { numberOfKeys: number; lua: string }): void {
    this.scripts.add(name);
  }

  /**
   * A TypeScript port of the rate-limit script, kept deliberately line-for-line
   * with the Lua so a change to one is an obvious change to the other.
   *
   * Arguments arrive as strings because that is how ioredis passes them to a
   * script; the return values are milliseconds, as the real script returns.
   */
  async vitalThrottle(
    hitsKey: string,
    blockKey: string,
    windowMs: string,
    limit: string,
    blockMs: string,
  ): Promise<[number, number, number, number]> {
    if (!this.scripts.has('vitalThrottle')) {
      throw new Error('NOSCRIPT: vitalThrottle was never defined');
    }

    const window = Number(windowMs);
    const ceiling = Number(limit);
    const penalty = Number(blockMs);

    const blockPttl = this.pttl(blockKey);
    if (blockPttl > 0) {
      const blockedHits = Number((await this.get(hitsKey)) ?? '0');
      return [blockedHits, blockPttl, 1, blockPttl];
    }

    const hits = await this.incr(hitsKey);
    let pttl = this.pttl(hitsKey);

    if (pttl < 0) {
      this.pexpire(hitsKey, window);
      pttl = window;
    }

    if (hits > ceiling) {
      await this.set(blockKey, '1', 'PX', penalty);
      return [hits, pttl, 1, penalty];
    }

    return [hits, pttl, 0, 0];
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async incr(key: string): Promise<number> {
    const current = this.read(key);
    const next = Number(current?.value ?? '0') + 1;

    // INCR preserves an existing TTL and creates the key without one.
    this.store.set(key, { value: String(next), expiresAt: current?.expiresAt ?? null });
    return next;
  }

  /** Remaining lifetime in ms: −2 when absent, −1 when it never expires. */
  private pttl(key: string): number {
    const entry = this.read(key);
    if (!entry) {
      return -2;
    }
    return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
  }

  private pexpire(key: string, ms: number): void {
    const entry = this.read(key);
    if (entry) {
      entry.expiresAt = Date.now() + ms;
    }
  }

  /** Reads a key, evicting it first if it has expired. */
  private read(key: string): Entry | null {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }
}

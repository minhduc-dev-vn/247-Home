export type RateLimitAction = string;

export type RateLimitPolicy = {
  limit: number;
  windowMs: number;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const policies: Record<RateLimitAction, RateLimitPolicy> = {
  login: { limit: 5, windowMs: 15 * 60 * 1_000 },
  register: { limit: 3, windowMs: 60 * 60 * 1_000 },
  'forgot-password': { limit: 3, windowMs: 60 * 60 * 1_000 },
  'operations-mutation': { limit: 30, windowMs: 60 * 1_000 },
  'sensitive-mutation': { limit: 30, windowMs: 60 * 1_000 },
  'password-reset': { limit: 5, windowMs: 60 * 60 * 1_000 },
};

const attempts = new Map<string, RateLimitEntry>();

export interface RateLimiter {
  consume(
    action: RateLimitAction,
    key: string,
    policy: RateLimitPolicy,
    now?: number,
  ): { allowed: boolean; retryAfterSeconds: number };
}

const inMemoryRateLimiter: RateLimiter = {
  consume(action, key, policy, now = Date.now()) {
    const mapKey = `${action}:${key}`;
    const previous = attempts.get(mapKey);

    if (!previous || previous.resetAt <= now) {
      attempts.set(mapKey, { count: 1, resetAt: now + policy.windowMs });
      return { allowed: true, retryAfterSeconds: 0 };
    }

    if (previous.count >= policy.limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((previous.resetAt - now) / 1_000),
        ),
      };
    }

    previous.count += 1;
    return { allowed: true, retryAfterSeconds: 0 };
  },
};

let activeRateLimiter: RateLimiter = inMemoryRateLimiter;

export function configureRateLimiter(rateLimiter: RateLimiter): void {
  activeRateLimiter = rateLimiter;
}

export function consumeRateLimit(
  action: RateLimitAction,
  key: string,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  return activeRateLimiter.consume(
    action,
    key,
    policies[action] ?? policies['sensitive-mutation'],
    now,
  );
}

export function clearRateLimitsForTest(): void {
  attempts.clear();
  activeRateLimiter = inMemoryRateLimiter;
}

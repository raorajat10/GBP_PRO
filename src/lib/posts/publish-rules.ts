/** Retry rules for publishing. Pure, unit-tested. */

export const MAX_PUBLISH_ATTEMPTS = 3;
/** Wait after the 1st and 2nd failed try. */
const RETRY_MINUTES = [10, 60];

/**
 * When to try again after a failed publish, or null to give up (mark failed).
 * Permanent problems (access removed, profile gone, Google refusing the content) aren't
 * retried: trying again can't fix them.
 */
export function nextAttempt(input: {
  attempts: number; // tries made so far, including the one that just failed
  permanent: boolean;
  now: Date;
}): string | null {
  if (input.permanent || input.attempts >= MAX_PUBLISH_ATTEMPTS) return null;
  const minutes = RETRY_MINUTES[input.attempts - 1] ?? RETRY_MINUTES.at(-1)!;
  return new Date(input.now.getTime() + minutes * 60_000).toISOString();
}

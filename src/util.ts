/**
 * Wait for a specified amount of time. delayAsync is not reentrant.
 *
 * @param duration the duration in milliseconds.
 */

let isDelaying = false;

export async function delayAsync(duration: number) {
  if (isDelaying)
    throw new Error('delayAsync is not reentrant.');

  isDelaying = true;

  return new Promise((resolve) => setTimeout(() => {
    isDelaying = false;
    resolve(undefined);
  }, duration));
}

/*
 * Factory for a timer that returns the number of milliseconds since the timer was created:
 * @example
 *   const timer = buildTimer();
 *   // later
 *   const elapsed = timer();
 */
export function buildTimer() {
  const startTime = performance.now();

  return () => {
    return Math.round(performance.now() - startTime);
  };
}

export type Handler<T extends ReadonlyArray<unknown> = []> = (...args: T) => void;

/**
 * Escape special characters that would cause errors if we interpolated them
 * into a regex.
 * @param expression The string to escape.
 * @returns The escaped string, usable in a regular expression constructor.
 */
export function escapeForRegex(expression: string): string {
  return expression.replaceAll(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

/** Returns a random number between min (inclusive) and max (exclusive). */
export function randomInt(max: number): number;
export function randomInt(min: number, max?: number): number {
  /* eslint-disable no-param-reassign */
  if (max === undefined) {
    max = min;
    min = 0;
  }
  if (max < min) {
    [min, max] = [max, min];
  }
  return Math.floor(Math.random() * (max - min)) + min;
  /* eslint-enable no-param-reassign */
}

export function randomInArray<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function randomByWeight<T extends Record<string, number>>(
  weights: T,
): keyof T;
export function randomByWeight<T>(weights: [T, number][] | Map<T, number>): T;
export function randomByWeight<T>(
  weights: [T, number][] | Map<T, number> | Record<string, number>,
): T | string {
  const weightPairs: [T | string, number][] =
    weights instanceof Map
      ? [...weights.entries()]
      : Array.isArray(weights)
        ? weights
        : Object.entries(weights);

  const keys: (T | string)[] = [];
  const values: number[] = [];
  for (const [k, v] of weightPairs) {
    keys.push(k);
    values.push(v);
  }

  const sum = values.reduce((p, c) => {
    if (c < 0) throw new Error("Negative weight!");
    return p + c;
  }, 0);

  if (sum === 0) throw new Error("Weights add up to zero!");

  const choose = Math.floor(Math.random() * sum);

  for (let i = 0, count = 0; i < keys.length; i++) {
    count += values[i];
    if (count > choose) {
      return keys[i];
    }
  }
  throw new Error("We goofed!");
}

const PREFIX = "{{slug}}:";

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

export function bestScore() {
  return load("best", 0);
}

export function recordScore(score: number) {
  const best = Math.max(score, bestScore());
  save("best", best);
  return best;
}

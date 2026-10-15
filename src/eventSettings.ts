export const DEFAULT_EVENT = {
  title: 'Grandes Obras HJCB',
  date: 'Outubro 2026',
  goal: 100,
};

const KEY = 'event';

export type EventSettings = typeof DEFAULT_EVENT;

function parseGoal(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_EVENT.goal;
  return Math.round(n);
}

export function readEventSettings(): EventSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_EVENT;
    const parsed = JSON.parse(raw) as Partial<EventSettings>;
    return {
      title: (parsed.title || '').trim() || DEFAULT_EVENT.title,
      date: (parsed.date || '').trim() || DEFAULT_EVENT.date,
      goal: parseGoal(parsed.goal),
    };
  } catch {
    return DEFAULT_EVENT;
  }
}

export function writeEventSettings(event: EventSettings) {
  const goal = Number.isFinite(event.goal) && event.goal >= 0 ? Math.round(event.goal) : DEFAULT_EVENT.goal;
  const next = {
    title: event.title.trim() || DEFAULT_EVENT.title,
    date: event.date.trim() || DEFAULT_EVENT.date,
    goal,
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

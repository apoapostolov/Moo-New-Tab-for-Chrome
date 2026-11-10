import { readNaturalDate } from '../google/naturalDates';
import { planningDay } from './planningDates';

/** Use the same local-calendar date grammar as Tasks; keep unsupported text intact. */
export function parsePlanInput(value, fallbackDate, today = planningDay()) {
  const text = value.trim();
  if (/^"[\s\S]*"$/.test(text))
    return {
      title: text.slice(1, -1).trim(),
      date: fallbackDate,
      explicit: false,
      ambiguous: false,
    };
  const now = new Date(`${today}T12:00:00`);
  const match = readNaturalDate(text, now, false);
  if (!match)
    return {
      title: text,
      date: fallbackDate,
      explicit: false,
      ambiguous: false,
      invalid: /\b\d{4}-\d{2}-\d{2}\b|\bin\s+-?\d+(?:\.\d+)?\s+days?\b/i.test(text),
    };
  const title = `${text.slice(0, match.index)} ${text.slice(match.index + match.length)}`
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, '')
    .trim();
  return {
    title,
    date: planningDay(match.date),
    explicit: true,
    ambiguous: Boolean(readNaturalDate(title, now, false)),
  };
}

export function parsePlanWhen(value, today = planningDay()) {
  const text = value.trim();
  if (!text || text.toLowerCase() === 'later') return { valid: true, date: null };
  const match = readNaturalDate(text, new Date(`${today}T12:00:00`), false);
  return match && match.index === 0 && match.length === text.length
    ? { valid: true, date: planningDay(match.date) }
    : { valid: false, date: null };
}

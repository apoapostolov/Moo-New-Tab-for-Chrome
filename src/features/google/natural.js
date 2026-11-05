import {
  addDays,
  DAY,
  midnight,
  nextWeekday,
  NUMBER,
  readNaturalDate,
  readNumber,
  WEEKDAYS,
} from './naturalDates.js';

const CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const ORDINALS = { first: 1, second: 2, third: 3, fourth: 4, last: -1 };
const mask = (s, i, n) => {
  s.work = s.work.slice(0, i) + ' '.repeat(n) + s.work.slice(i + n);
};
const take = (s, pattern, read) => {
  for (const m of s.work.matchAll(
    new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g'),
  )) {
    const value = read(m);
    if (value === null || value === undefined || value === false) continue;
    mask(s, m.index, m[0].length);
    return value;
  }
  return null;
};
const UNIT = '(?:hours?|hrs?|h|minutes?|mins?|m|days?|d)(?![a-z])';
const DURATION = `(?:half\\s+an?\\s+hour|${NUMBER}(?:\\s+and\\s+(?:a\\s+)?half)?\\s*${UNIT}(?:\\s*(?:and\\s+)?${NUMBER}\\s*${UNIT}){0,2}(?:\\s+and\\s+(?:a\\s+)?(?:half|quarter))?)`;
const readDuration = (text) => {
  if (/^half\s+an?\s+hour$/i.test(text)) return 30;
  let total = 0,
    first = 0;
  for (const m of text.matchAll(
    new RegExp(`(${NUMBER})(\\s+and\\s+(?:a\\s+)?half)?\\s*(${UNIT})`, 'gi'),
  )) {
    const unit = /^h/i.test(m[3]) ? 60 : /^d/i.test(m[3]) ? 1440 : 1;
    first ||= unit;
    total += (readNumber(m[1]) + (m[2] ? 0.5 : 0)) * unit;
  }
  if (/\band\s+(?:a\s+)?(?:half|quarter)$/i.test(text))
    total += first * (/quarter$/i.test(text) ? 0.25 : 0.5);
  return total >= 1 && total <= 525600 ? Math.round(total) : null;
};
const CLOCK = `(?:${NUMBER}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?)?|noon|midday|midnight)`;
const readClock = (raw) => {
  const text = raw.trim().toLowerCase().replace(/\./g, '');
  if (/^(noon|midday|midnight)$/.test(text))
    return { hours: text === 'midnight' ? 0 : 12, minutes: 0, explicit: true };
  const m = text.match(new RegExp(`^(${NUMBER})(?::(\\d{2}))?\\s*(am|pm)?$`, 'i'));
  if (!m) return null;
  let hours = readNumber(m[1]);
  const minutes = Number(m[2] || 0);
  if (
    !Number.isInteger(hours) ||
    hours < 0 ||
    hours > 23 ||
    minutes > 59 ||
    (m[3] && (hours < 1 || hours > 12))
  )
    return null;
  if (m[3]) hours = (hours % 12) + (m[3] === 'pm' ? 12 : 0);
  return { hours, minutes, explicit: Boolean(m[3]) };
};
const clockOnly = ({ hours, minutes }) => ({ hours, minutes });
const REPEAT = new RegExp(
  `\\b(?:every|each)\\s+(?:(?:other|${NUMBER})\\s+)?(?:single\\s+)?(?:${DAY}|days?|weeks?|months?|years?|weekdays?|weekends?)s?(?:\\s*(?:,|and|&)\\s*(?:${DAY})s?)*(?:\\s+on\\s+(?:${DAY})s?(?:\\s*(?:,|and|&)\\s*(?:${DAY})s?)*)?\\b|\\b(?:daily|weekly|monthly|yearly|annually|fortnightly|biweekly|weekdays|weekends)(?:\\s+on\\s+(?:${DAY})s?(?:\\s*(?:,|and|&)\\s*(?:${DAY})s?)*)?\\b`,
  'i',
);
const readRepeat = (text) => {
  const unit =
    text
      .match(
        /\b(days?|weeks?|months?|years?|daily|weekly|monthly|yearly|annually|fortnightly|biweekly|weekdays?|weekends?)\b/i,
      )?.[0]
      .toLowerCase() || '';
  const days = [...text.matchAll(new RegExp(`\\b(${DAY})s?\\b`, 'gi'))].map(
    (m) => WEEKDAYS[m[1].toLowerCase()],
  );
  const amount = text.match(
    new RegExp(`\\b(?:every|each)\\s+(${NUMBER})\\s+(?:days?|weeks?|months?|years?)\\b`, 'i'),
  );
  const interval = /\bother\b|fortnightly|biweekly/i.test(text)
    ? 2
    : amount
      ? readNumber(amount[1])
      : 1;
  if (!Number.isInteger(interval) || interval < 1 || interval > 365) return null;
  if (/weekday/.test(unit)) return { freq: 'WEEKLY', interval, byDay: [1, 2, 3, 4, 5] };
  if (/weekend/.test(unit)) return { freq: 'WEEKLY', interval, byDay: [6, 0] };
  return {
    freq:
      days.length || /week|fortnight/.test(unit)
        ? 'WEEKLY'
        : /month/.test(unit)
          ? 'MONTHLY'
          : /year|annually/.test(unit)
            ? 'YEARLY'
            : 'DAILY',
    interval,
    ...(days.length ? { byDay: [...new Set(days)] } : {}),
  };
};
const nextRepeat = (repeat, now) => {
  if (repeat.freq === 'MONTHLY' && (repeat.bySetPos || repeat.byMonthDay))
    for (let m = 0; m < 13; m++) {
      const first = new Date(now.getFullYear(), now.getMonth() + m, 1);
      let date;
      if (repeat.byMonthDay)
        date = new Date(first.getFullYear(), first.getMonth(), repeat.byMonthDay);
      else {
        date = nextWeekday(first, repeat.byDay[0]);
        if (repeat.bySetPos === -1) {
          while (addDays(date, 7).getMonth() === first.getMonth()) date = addDays(date, 7);
        } else date = addDays(date, (repeat.bySetPos - 1) * 7);
      }
      if (date >= midnight(now) && date.getMonth() === first.getMonth()) return date;
    }
  return repeat.byDay?.length
    ? new Date(Math.min(...repeat.byDay.map((d) => nextWeekday(now, d).getTime())))
    : midnight(now);
};

/** English field extraction in local time. Unknown text remains available as the title. */
export function parseNatural(
  text,
  { now = new Date(), kind = 'event', calendars = [], allowRepeat = true, defaultDate } = {},
) {
  const original = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  const state = { work: ` ${original} ` };
  const r = {
    title: '',
    date: null,
    endDate: null,
    time: null,
    endTime: null,
    durationMinutes: null,
    allDay: false,
    repeat: null,
    location: null,
    notes: null,
    status: null,
    calendarId: null,
    understood: false,
    dateExplicit: false,
    issues: [],
  };
  if (original.length > 20000) return { ...r, title: original };
  const field = (names) =>
    new RegExp(
      `\\b(?:with\\s+)?(?:${names})\\s*(?::\\s*|\\s+(?=["']))(?:"([^"]*)"|'([^']*)'|([^;]+))`,
      'i',
    );
  const content = (m) => (m[1] ?? m[2] ?? m[3] ?? '').trim();
  r.notes = take(state, field('notes?|description'), content);
  const literalTitle = take(state, field('title'), content);
  if (kind === 'task')
    r.status = take(
      state,
      /\bstatus\s*:\s*(completed|complete|done|open|pending|incomplete|needsAction)\b/i,
      (m) => (/^(completed|complete|done)$/i.test(m[1]) ? 'completed' : 'needsAction'),
    );
  if (kind === 'event') {
    r.location =
      take(state, field('location|place'), content) ||
      take(state, /\b(?:at|in)\s+["']([^"']+)["']/i, (m) => m[1]);
    r.calendarId = take(
      state,
      field('calendar'),
      (m) =>
        calendars.find((c) =>
          [c.id, c.summary].some((name) => name?.toLowerCase() === content(m).toLowerCase()),
        )?.id,
    );
  }
  const literals = [];
  const protect = (value) => {
    const token = `\uE000${String.fromCharCode(65 + literals.length)}\uE001`;
    literals.push([token, value]);
    return token;
  };
  const restore = (value) =>
    literals.reduce((work, [token, literal]) => work.replaceAll(token, literal), value);
  state.work = state.work.replace(/"[^"]*"/g, protect);
  if (kind === 'event' && allowRepeat) {
    r.repeat = take(
      state,
      new RegExp(
        `\\b(?:every|each)\\s+(first|second|third|fourth|last)\\s+(${DAY})(?:\\s+of\\s+(?:(?:every|each|the)\\s+)?month)?\\b`,
        'i',
      ),
      (m) => ({
        freq: 'MONTHLY',
        interval: 1,
        byDay: [WEEKDAYS[m[2].toLowerCase()]],
        bySetPos: ORDINALS[m[1].toLowerCase()],
      }),
    );
    r.repeat ||= take(
      state,
      /\b(?:every|each)\s+month\s+on\s+(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)?\b/i,
      (m) =>
        +m[1] >= 1 && +m[1] <= 31 ? { freq: 'MONTHLY', interval: 1, byMonthDay: +m[1] } : null,
    );
    if (!r.repeat) {
      const matches = [...state.work.matchAll(new RegExp(REPEAT.source, 'gi'))];
      const match = matches.find((item) => /^(every|each)\b/i.test(item[0])) || matches[0];
      if (match) {
        r.repeat = readRepeat(match[0]);
        if (r.repeat) mask(state, match.index, match[0].length);
      }
    }
    if (r.repeat) {
      const count = take(
        state,
        new RegExp(`\\bfor\\s+(${NUMBER})\\s+(?:times?|occurrences?)\\b`, 'i'),
        (m) => {
          const n = readNumber(m[1]);
          return Number.isInteger(n) && n > 0 && n <= 10000 ? n : null;
        },
      );
      if (count) r.repeat.count = count;
      const untilPrefix = /\buntil\s+/i.exec(state.work);
      if (untilPrefix) {
        const offset = untilPrefix.index + untilPrefix[0].length;
        const until = readNaturalDate(state.work.slice(offset), now, false);
        if (until?.index === 0) {
          r.repeat.until = until.date;
          mask(state, untilPrefix.index, untilPrefix[0].length + until.length);
        }
      }
    }
  } else {
    state.work = state.work.replace(
      new RegExp(
        `\\b(?:every|each)\\s+(?:first|second|third|fourth|last)\\s+(?:${DAY})(?:\\s+of\\s+(?:(?:every|each|the)\\s+)?month)?\\b`,
        'gi',
      ),
      protect,
    );
    const hasUnsupportedRepeat =
      literals.some(([, value]) => /^(every|each)\b/i.test(value)) ||
      new RegExp(REPEAT.source, 'i').test(state.work);
    state.work = state.work.replace(new RegExp(REPEAT.source, 'gi'), protect);
    if (hasUnsupportedRepeat) state.work = state.work.replace(/\buntil\s+[^;,]+/gi, protect);
    if (kind === 'task')
      state.work = state.work.replace(
        new RegExp(
          `(?:\\bat\\s+|@\\s*)${CLOCK}\\b|\\b\\d{1,2}:\\d{2}\\s*(?:am|pm)?\\b|\\b\\d{1,2}\\s*(?:am|pm)\\b`,
          'gi',
        ),
        protect,
      );
  }
  let startBound = null,
    endBound = null;
  if (kind === 'event') {
    const bounds =
      /\b(starts?|ends?|begins?|finishes?)\s*(?::\s*|\s+)(.+?)(?=\s+and\s+(?:starts?|ends?|begins?|finishes?)\b|;|$)/i;
    for (let n = 0; n < 2; n++)
      take(state, bounds, (m) => {
        const d = readNaturalDate(m[2], now, false);
        let work = m[2];
        if (d)
          work = work.slice(0, d.index) + ' '.repeat(d.length) + work.slice(d.index + d.length);
        const clock = work.match(new RegExp(`(?:\\bat\\s+|^\\s*)(${CLOCK})\\s*$`, 'i'));
        const time = clock && readClock(clock[1]);
        if ((!d && !time) || work.replace(clock?.[0] || '', '').trim()) return null;
        const bound = { date: d?.date, time: time && clockOnly(time) };
        if (/^(start|begin)/i.test(m[1])) startBound = bound;
        else endBound = bound;
        return bound;
      });
    r.allDay = Boolean(take(state, /\ball[ -]day\b/i, () => true));
  }
  const date = readNaturalDate(state.work, now);
  if (date) {
    r.date = date.date;
    r.endDate = date.endDate;
    r.dateExplicit = true;
    mask(state, date.index, date.length);
  }
  if (startBound?.date) {
    r.date = startBound.date;
    r.dateExplicit = true;
  }
  if (endBound?.date) r.endDate = endBound.date;
  if (kind === 'event') {
    r.durationMinutes = take(
      state,
      new RegExp(`\\b(?:for|lasting(?:\\s+for)?)\\s+(${DURATION})\\b`, 'i'),
      (m) => readDuration(m[1]),
    );
    let explicitPeriod = false;
    const range = take(
      state,
      new RegExp(
        `(?<![\\w/.-])(?:(from|between|at)\\s+)?(${CLOCK})\\s*(to|until|till|[-–—]|and)\\s*(${CLOCK})(?![\\w/.-])`,
        'i',
      ),
      (m) => {
        if (m[3].toLowerCase() === 'and' && m[1]?.toLowerCase() !== 'between') return null;
        const start = readClock(m[2]),
          end = readClock(m[4]);
        if (!start || !end) return null;
        const nearest = (hours, distance) =>
          [hours % 12, (hours % 12) + 12].sort((a, b) => distance(a) - distance(b))[0];
        if (!start.explicit && start.hours <= 12 && end.explicit)
          start.hours = nearest(start.hours, (h) => (end.hours - h + 24) % 24 || 24);
        if (start.explicit && !end.explicit && end.hours <= 12)
          end.hours = nearest(end.hours, (h) => (h - start.hours + 24) % 24 || 24);
        explicitPeriod = start.explicit || end.explicit;
        return { start: clockOnly(start), end: clockOnly(end) };
      },
    );
    if (range) {
      r.time = range.start;
      r.endTime = range.end;
    }
    if (!r.time) {
      const relative = take(state, new RegExp(`\\b(?:in|after)\\s+(${DURATION})\\b`, 'i'), (m) => {
        const minutes = readDuration(m[1]);
        return minutes && !r.date ? new Date(now.getTime() + minutes * 60000) : null;
      });
      if (relative) {
        r.date = midnight(relative);
        r.dateExplicit = true;
        r.time = { hours: relative.getHours(), minutes: relative.getMinutes() };
      }
      const colloquial =
        !r.time &&
        take(
          state,
          new RegExp(
            `\\b(?:at\\s+)?(half|quarter|${NUMBER})\\s+(past|to)\\s+(${NUMBER})(?:\\s*(am|pm))?\\b`,
            'i',
          ),
          (m) => {
            const h = readClock(m[3] + (m[4] || '')),
              minutes = /half/i.test(m[1]) ? 30 : /quarter/i.test(m[1]) ? 15 : readNumber(m[1]);
            if (!h || !Number.isInteger(minutes) || minutes < 1 || minutes > 59) return null;
            explicitPeriod = h.explicit;
            return m[2].toLowerCase() === 'to'
              ? { hours: (h.hours + 23) % 24, minutes: 60 - minutes }
              : { hours: h.hours, minutes };
          },
        );
      if (colloquial) r.time = colloquial;
      const written =
        !r.time &&
        take(
          state,
          new RegExp(
            `\\b(?:at\\s+)?(${NUMBER})\\s+o'?clock\\b|\\bat\\s+(${NUMBER})\\s+(${NUMBER})(?:\\s*(am|pm))?\\b`,
            'i',
          ),
          (m) => {
            const hour = readNumber(m[1] || m[2]),
              minutes = m[3] ? readNumber(m[3]) : 0;
            const value = readClock(`${hour}:${String(minutes).padStart(2, '0')}${m[4] || ''}`);
            if (!value) return null;
            explicitPeriod = value.explicit;
            return clockOnly(value);
          },
        );
      if (written) r.time = written;
      const single =
        !r.time &&
        take(
          state,
          new RegExp(
            `(?:\\bat\\s+|@\\s*)(${CLOCK})(?![\\w:.])|\\b(\\d{1,2}:\\d{2}\\s*(?:am|pm)?|\\d{1,2}\\s*(?:am|pm)|noon|midday|midnight)\\b`,
            'i',
          ),
          (m) => {
            const c = readClock(m[1] || m[2]);
            if (!c) return null;
            explicitPeriod = c.explicit;
            return clockOnly(c);
          },
        );
      if (single) r.time = single;
    }
    const period = take(
      state,
      /\b(?:(?:in\s+the|this)\s+)?(morning|afternoon|evening|night)\b/i,
      (m) => (r.time || r.date ? m[1].toLowerCase() : null),
    );
    if (period && !explicitPeriod) {
      if (!r.time)
        r.time = { hours: period === 'morning' ? 9 : period === 'afternoon' ? 15 : 19, minutes: 0 };
      else if (period !== 'morning' && r.time.hours < 12) r.time.hours += 12;
      else if (period === 'morning' && r.time.hours === 12) r.time.hours = 0;
    }
    if (startBound?.time) r.time = startBound.time;
    if (endBound?.time) r.endTime = endBound.time;
    if (date?.endOfDay && !r.time) r.time = { hours: 23, minutes: 59 };
    r.location ||=
      ((r.date || r.time || r.repeat || r.durationMinutes || /@/.test(state.work)) &&
        take(state, /(?:\bat\s+|@)([^,;\uE000]+?)(?=\s{2,}|[,;]|$)/i, (m) => {
          const place = m[1].trim();
          return place.length > 1 && !/^(?:\d|least\b|most\b|all\b)/i.test(place) ? place : null;
        })) ||
      null;
  }
  if (r.repeat && !r.date) r.date = nextRepeat(r.repeat, now);
  if (r.repeat?.count && r.repeat.until)
    r.issues.push('Choose a repeat count or an end date, rather than both.');
  if (r.repeat?.until && r.date && r.repeat.until < r.date)
    r.issues.push('Choose a repeat end date on or after its start.');
  if ((r.time || r.allDay) && !r.date) {
    r.date = midnight(defaultDate ? new Date(`${defaultDate}T00:00:00`) : now);
    if (
      !defaultDate &&
      !r.dateExplicit &&
      r.time &&
      (r.time.hours < now.getHours() ||
        (r.time.hours === now.getHours() && r.time.minutes < now.getMinutes()))
    )
      r.date = addDays(r.date, 1);
  }
  if (r.allDay) {
    r.time = null;
    r.endTime = null;
  }
  if (r.date && !r.time && r.durationMinutes >= 1440 && !r.endDate)
    r.endDate = addDays(r.date, Math.ceil(r.durationMinutes / 1440) - 1);
  r.understood = Boolean(
    r.date ||
    r.time ||
    r.repeat ||
    r.durationMinutes ||
    r.location ||
    r.notes !== null ||
    r.status ||
    r.calendarId ||
    literalTitle,
  );
  let title = restore(state.work)
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.–—-]+|[\s,;:.–—-]+$/g, '');
  if (r.understood)
    title = title
      .replace(/^(?:please\s+)?remind me to\s+/i, '')
      .replace(/\s+(?:on|at|from|by|starting|beginning|for|due|until)\s*$/i, '');
  r.title = [literalTitle, title].filter(Boolean).join(' ').trim();
  return r;
}

export const toRrule = (repeat, { allDay = false } = {}) => {
  if (!repeat?.freq) return null;
  const parts = [`FREQ=${repeat.freq}`];
  if (repeat.interval > 1) parts.push(`INTERVAL=${repeat.interval}`);
  if (repeat.byDay?.length) parts.push(`BYDAY=${repeat.byDay.map((d) => CODES[d]).join(',')}`);
  if (repeat.bySetPos) parts.push(`BYSETPOS=${repeat.bySetPos}`);
  if (repeat.byMonthDay) parts.push(`BYMONTHDAY=${repeat.byMonthDay}`);
  if (repeat.count >= 1) parts.push(`COUNT=${repeat.count}`);
  else if (repeat.until) {
    const day = `${repeat.until.getFullYear()}${String(repeat.until.getMonth() + 1).padStart(2, '0')}${String(repeat.until.getDate()).padStart(2, '0')}`;
    const end = new Date(
      repeat.until.getFullYear(),
      repeat.until.getMonth(),
      repeat.until.getDate(),
      23,
      59,
      59,
    );
    parts.push(`UNTIL=${allDay ? day : end.toISOString().replace(/[-:]|\.000/g, '')}`);
  }
  return `RRULE:${parts.join(';')}`;
};
export const describe = (p, kind = 'event') => {
  if (!p?.understood) return '';
  const bits = [],
    clock = (v) => `${String(v.hours).padStart(2, '0')}:${String(v.minutes).padStart(2, '0')}`,
    day = (v) =>
      v.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
  if (p.date) bits.push(p.endDate ? `${day(p.date)} → ${day(p.endDate)}` : day(p.date));
  if (p.time && kind === 'event')
    bits.push(
      p.endTime
        ? `${clock(p.time)}–${clock(p.endTime)}`
        : `from ${clock(p.time)}${p.durationMinutes ? `, ${p.durationMinutes} min` : ''}`,
    );
  else if (p.date && kind === 'event') bits.push('all day');
  else if (p.durationMinutes) bits.push(`${p.durationMinutes} min`);
  if (p.repeat) {
    const unit = { DAILY: 'day', WEEKLY: 'week', MONTHLY: 'month', YEARLY: 'year' }[p.repeat.freq];
    bits.push(
      `every ${p.repeat.interval > 1 ? p.repeat.interval + ' ' : ''}${unit}${p.repeat.interval > 1 ? 's' : ''}${p.repeat.byDay?.length ? ' (' + p.repeat.byDay.map((d) => new Date(2024, 0, 7 + d).toLocaleDateString('en-GB', { weekday: 'short' })).join(', ') + ')' : ''}${p.repeat.bySetPos ? ' · ' + Object.keys(ORDINALS).find((k) => ORDINALS[k] === p.repeat.bySetPos) : ''}${p.repeat.count ? ', ' + p.repeat.count + ' times' : p.repeat.until ? ', until ' + day(p.repeat.until) : ''}`,
    );
  }
  if (p.location) bits.push(`at ${p.location}`);
  if (p.notes !== null) bits.push('notes added');
  if (p.status) bits.push(p.status === 'completed' ? 'completed' : 'open');
  if (p.calendarId) bits.push('calendar selected');
  return bits.join(' · ');
};

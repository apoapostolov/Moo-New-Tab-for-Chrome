import { ZONES } from 'utils/widgets';

const GAP_REACH = 2;

/** Where the pointer sits on the cards as they were when the drag began. */
export const captureGeometry = () => {
  const geometry = {};

  ZONES.forEach((zone) => {
    const column = document.querySelector(`.widgetZone[data-zone="${zone}"]`);

    if (!column) return;

    const box = column.getBoundingClientRect();

    geometry[zone] = {
      left: box.left,
      right: box.right,
      top: box.top,
      bottom: box.bottom,
      cards: [...column.querySelectorAll('.zoneCard')].map((card) => {
        const rect = card.getBoundingClientRect();

        return {
          id: card.dataset.widgetId,
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
      gaps: [...column.querySelectorAll('.zoneRow')].map((row, index) => {
        const rect = row.getBoundingClientRect();
        return { index, top: rect.top - 6, bottom: rect.top };
      }),
    };
  });

  return geometry;
};

/** The column the pointer is in, or the one it is nearest. */
const pickZone = (geometry, { x, y }) => {
  let best = null;
  let distance = Infinity;

  ZONES.forEach((zone) => {
    const column = geometry[zone];

    if (!column) return;

    const dx = Math.max(column.left - x, 0, x - column.right);
    const dy = Math.max(column.top - y, 0, y - column.bottom);
    const away = Math.hypot(dx, dy);

    if (away < distance) {
      distance = away;
      best = zone;
    }
  });

  return best;
};

/**
 * The place the card would land, read off the frozen geometry rather than the live
 * layout: the opening this answer draws changes the layout, and asking the changed
 * layout again would flip the answer back and forth until React gives up.
 */
export const readTarget = (geometry, point) => {
  const zone = pickZone(geometry, point);

  if (!zone) return null;

  const column = geometry[zone];

  if (column.cards.length === 0) {
    return { zone, overId: null, side: zone === 'center' ? 'a' : 'after', index: 0 };
  }

  // In the middle column the line between two rows is a place of its own.
  if (zone === 'center') {
    const gap = column.gaps.find(
      (item) => point.y >= item.top - GAP_REACH && point.y <= item.bottom + GAP_REACH,
    );

    if (gap) return { zone, overId: null, side: 'at', index: gap.index };
  }

  let nearest = column.cards[0];
  let distance = Infinity;

  column.cards.forEach((card) => {
    const away =
      point.y < card.top ? card.top - point.y : point.y > card.bottom ? point.y - card.bottom : 0;

    if (away < distance) {
      distance = away;
      nearest = card;
    }
  });

  if (zone === 'center') {
    return {
      zone,
      overId: nearest.id,
      side: point.x < (nearest.left + nearest.right) / 2 ? 'a' : 'b',
    };
  }

  return {
    zone,
    overId: nearest.id,
    side: point.y < (nearest.top + nearest.bottom) / 2 ? 'before' : 'after',
  };
};

export const sameTarget = (a, b) => {
  if (!a || !b) return a === b;

  return a.zone === b.zone && a.overId === b.overId && a.side === b.side && a.index === b.index;
};

import { isFullWidth } from 'utils/widgets';
import { SLOT } from './overviewLabels';
/** Rows back to a flat order and the middle column's second lane. */
export const fromRows = (rows) => {
  const ids = [];
  const lane = [];

  rows.forEach((row) =>
    row.forEach((id, index) => {
      if (id === SLOT) return;

      ids.push(id);

      if (index === 1) lane.push(id);
    }),
  );

  return { ids, lane };
};

/**
 * The rows a drop produces. Over a lone card the arriving card takes the side the
 * pointer is on and that card steps to the other side, so the two share a row. A pair
 * already sharing a row stays together and the arriving card takes a row of its own
 * either side of it. On the line between rows it takes a row of its own there. In a
 * rail every row holds one card, so any drop simply opens a row.
 */
export const placeRows = ({ zone, rows, insert, overId, side, index, insertWide }) => {
  const next = rows.map((row) => [...row]);
  // The clock, the date, the one-line weather and the query line read across the whole
  // middle column: they never take half of a row, and nothing pairs with them. The card
  // in the air is a placeholder in the preview, so its kind is passed in rather than read.
  const wide = insertWide || (overId ? isFullWidth(overId) : false);

  if (!overId) {
    next.splice(Math.min(index ?? 0, next.length), 0, [insert]);

    return next;
  }

  const at = next.findIndex((row) => row.includes(overId));

  if (at < 0) return [...next, [insert]];

  if (zone !== 'center') {
    next.splice(side === 'after' ? at + 1 : at, 0, [insert]);

    return next;
  }

  const row = next[at];

  if (row.length > 1 || wide) {
    next.splice(side === 'a' ? at : at + 1, 0, [insert]);

    return next;
  }

  next.splice(at, 1, side === 'b' ? [overId, insert] : [insert, overId]);

  return next;
};

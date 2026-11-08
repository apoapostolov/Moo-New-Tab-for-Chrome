import { ZONES, isFullWidth } from 'utils/widgets';
export const moveOverviewWithKeys = ({
  id,
  key,
  shift,
  zone,
  activeId,
  setGroups,
  setSecondLane,
}) => {
  if (!zone || activeId) return;
  if (shift && zone === 'center' && !isFullWidth(id) && ['ArrowLeft', 'ArrowRight'].includes(key)) {
    setSecondLane((current) =>
      key === 'ArrowRight' ? [...new Set([...current, id])] : current.filter((item) => item !== id),
    );
  } else if (['ArrowLeft', 'ArrowRight'].includes(key)) {
    const destination = ZONES[ZONES.indexOf(zone) + (key === 'ArrowLeft' ? -1 : 1)];
    if (!destination) return;
    setGroups((current) => ({
      ...current,
      [zone]: current[zone].filter((item) => item !== id),
      [destination]: [...current[destination], id],
    }));
    setSecondLane((current) => current.filter((item) => item !== id));
  } else {
    setGroups((current) => {
      const items = [...current[zone]];
      const peers = items.filter(
        (item) => zone !== 'center' || isFullWidth(item) === isFullWidth(id),
      );
      const other = peers[peers.indexOf(id) + (key === 'ArrowUp' ? -1 : 1)];
      if (!other) return current;
      const from = items.indexOf(id);
      const to = items.indexOf(other);
      [items[from], items[to]] = [items[to], items[from]];
      return { ...current, [zone]: items };
    });
  }
  globalThis.requestAnimationFrame(() =>
    document.querySelector(`[data-widget-id="${id}"] .dragHandle`)?.focus(),
  );
};

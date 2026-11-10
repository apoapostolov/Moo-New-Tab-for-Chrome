export function planningGroups(items, date, today) {
  const selected = items.filter((item) => item.date === date);
  return {
    active: selected.filter((item) => !item.done),
    done: selected.filter((item) => item.done),
    earlier:
      date === today ? items.filter((item) => item.date && item.date < today && !item.done) : [],
  };
}

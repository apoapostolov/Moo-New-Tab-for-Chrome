import { MAX_PLANNING_TASKS } from './planningSchema';

export function addPlanTask(items, draft) {
  if (items.length >= MAX_PLANNING_TASKS) throw new Error('limit');
  return [
    ...items,
    {
      id: crypto.randomUUID(),
      notes: '',
      minutes: 0,
      priority: false,
      done: false,
      revision: 0,
      ...draft,
      title: draft.title.trim(),
    },
  ];
}

export function changePlanTask(items, id, revision, patch) {
  const task = items.find((item) => item.id === id);
  if (!task || task.revision !== revision) throw new Error('changed');
  const next = { ...task, ...patch, revision: revision + 1 };
  if (Object.hasOwn(patch, 'date') && patch.date !== task.date)
    next.priority = patch.priority === true;
  next.title = next.title.trim();
  next.notes = next.notes.trim();
  if (
    next.priority &&
    items.filter((item) => item.id !== id && item.date === next.date && item.priority).length >= 3
  )
    throw new Error('priority');
  return items.map((item) => (item.id === id ? next : item));
}

export function removePlanTask(items, id, revision) {
  const task = items.find((item) => item.id === id);
  if (!task || task.revision !== revision) throw new Error('changed');
  return items.filter((item) => item.id !== id);
}

export function restorePlanTask(items, task, index) {
  if (items.some((item) => item.id === task.id)) throw new Error('changed');
  if (items.length >= MAX_PLANNING_TASKS) throw new Error('limit');
  if (task.priority && items.filter((item) => item.date === task.date && item.priority).length >= 3)
    throw new Error('priority');
  const next = [...items];
  next.splice(Math.min(index, next.length), 0, task);
  return next;
}

export function clearCompletedPlanning(items, selected) {
  const revisions = new Map(selected.map((item) => [item.id, item.revision]));
  return items.filter((item) => {
    if (!revisions.has(item.id)) return true;
    if (item.revision !== revisions.get(item.id)) throw new Error('changed');
    return !item.done;
  });
}

export function reorderPlanTask(items, id, revision, delta) {
  const task = items.find((item) => item.id === id);
  if (!task || task.revision !== revision) throw new Error('changed');
  const peers = items.filter(
    (item) => item.date === task.date && item.done === task.done && item.priority === task.priority,
  );
  const other = peers[peers.indexOf(task) + delta];
  if (!other) return items;
  const next = [...items];
  const from = next.indexOf(task),
    to = next.indexOf(other);
  next[from] = { ...other, revision: other.revision + 1 };
  next[to] = { ...task, revision: task.revision + 1 };
  return next;
}

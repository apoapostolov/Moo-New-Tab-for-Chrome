import { validPlanDay } from './planningDates';

export const MAX_PLANNING_TASKS = 500;
const text = (value, limit) => typeof value === 'string' && value.length <= limit;

export function validPlanningTask(task) {
  return Boolean(
    task &&
    text(task.id, 100) &&
    task.id &&
    text(task.title, 200) &&
    task.title.trim() &&
    text(task.notes, 2000) &&
    (task.date === null || validPlanDay(task.date)) &&
    Number.isInteger(task.minutes) &&
    task.minutes >= 0 &&
    task.minutes <= 1440 &&
    typeof task.priority === 'boolean' &&
    (!task.priority || task.date !== null) &&
    typeof task.done === 'boolean' &&
    Number.isSafeInteger(task.revision) &&
    task.revision >= 0,
  );
}

export function validPlanning(items) {
  if (!Array.isArray(items) || items.length > MAX_PLANNING_TASKS || !items.every(validPlanningTask))
    return false;
  if (new Set(items.map((item) => item.id)).size !== items.length) return false;
  const priorities = new Map();
  for (const item of items.filter((task) => task.priority)) {
    const count = (priorities.get(item.date) || 0) + 1;
    if (count > 3) return false;
    priorities.set(item.date, count);
  }
  return true;
}

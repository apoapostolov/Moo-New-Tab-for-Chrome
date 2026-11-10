import { uiText } from 'lib/translations';
import PlanningRow from './PlanningRow';
import { planningGroups } from './planningView';

export default function PlanningList({ items, date, today, change, pending, onEdit }) {
  const { active, done, earlier } = planningGroups(items, date, today);
  const draw = (rows, bringTo) => (
    <ul className="planningList">
      {rows.map((task) => (
        <PlanningRow key={task.id} {...{ task, change, pending, onEdit, bringTo }} />
      ))}
    </ul>
  );
  const group = (key, rows) =>
    rows.length > 0 && (
      <section className="planningGroup">
        <h3>{uiText(key)}</h3>
        {draw(rows, date === null ? today : null)}
      </section>
    );
  return (
    <div className="planningBody">
      {!active.length && (
        <p className="planningEmpty">
          {uiText(date === null ? 'planning_empty_later' : 'planning_empty_day')}
        </p>
      )}
      {group(
        'planning_priorities',
        active.filter((item) => item.priority),
      )}
      {group(
        date === null ? 'planning_later' : 'planning_rest',
        active.filter((item) => !item.priority),
      )}
      {done.length > 0 && (
        <details className="planningGroup planningCompleted">
          <summary>{uiText('planning_done_count', { count: done.length })}</summary>
          {draw(done)}
        </details>
      )}
      {earlier.length > 0 && (
        <details className="planningGroup planningEarlier">
          <summary>{uiText('planning_earlier_count', { count: earlier.length })}</summary>
          <p>{uiText('planning_earlier_hint')}</p>
          {draw(earlier, today)}
        </details>
      )}
    </div>
  );
}

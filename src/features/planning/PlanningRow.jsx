import { MdStar, MdStarBorder, MdArrowForward } from 'react-icons/md';
import { uiText } from 'lib/translations';
import { IconButton } from '../widgetKit/WidgetKit';
import { changePlanTask } from './planningActions';

export default function PlanningRow({ task, change, pending, onEdit, bringTo }) {
  return (
    <li className={`planningRow${task.done ? ' planningDone' : ''}`}>
      <input
        type="checkbox"
        checked={task.done}
        disabled={pending}
        aria-label={uiText(task.done ? 'planning_reopen' : 'planning_complete', {
          name: task.title,
        })}
        onChange={() =>
          change((items) => changePlanTask(items, task.id, task.revision, { done: !task.done }))
        }
      />
      <button
        type="button"
        className="planningTask"
        onClick={() => onEdit(task)}
        aria-label={uiText('edit_named', { name: task.title })}
      >
        <span>{task.title}</span>
        {task.notes && <small>{task.notes}</small>}
        {task.minutes > 0 && (
          <small className="planningEstimate">
            {uiText('planning_minutes', { count: task.minutes })}
          </small>
        )}
      </button>
      {bringTo ? (
        <IconButton
          label={uiText('planning_bring_named', { name: task.title })}
          disabled={pending}
          onClick={() =>
            change((items) => changePlanTask(items, task.id, task.revision, { date: bringTo }))
          }
        >
          <MdArrowForward />
        </IconButton>
      ) : (
        !task.done &&
        task.date !== null && (
          <IconButton
            label={uiText('planning_prioritize_named', { name: task.title })}
            aria-pressed={task.priority}
            disabled={pending}
            onClick={() =>
              change((items) =>
                changePlanTask(items, task.id, task.revision, { priority: !task.priority }),
              )
            }
          >
            {task.priority ? <MdStar className="planningStar" /> : <MdStarBorder />}
          </IconButton>
        )
      )}
    </li>
  );
}

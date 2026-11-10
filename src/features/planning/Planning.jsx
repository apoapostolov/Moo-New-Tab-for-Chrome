import { useState } from 'react';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { WidgetShell } from '../widgetKit/WidgetKit';
import { planDate } from './planningDates';
import { planningBudget } from './planningStore';
import { removePlanTask, restorePlanTask } from './planningActions';
import usePlanning from './usePlanning';
import PlanningDialog from './PlanningDialog';
import PlanningList from './PlanningList';
import PlanningCapture from './PlanningCapture';
import './planning.scss';

export default function Planning() {
  const { language } = useTranslationVersion();
  const state = usePlanning();
  const { items, today, change, pending, damaged, error } = state;
  const [tab, setTab] = useState('today');
  const [editing, setEditing] = useState(null);
  const [deleted, setDeleted] = useState(null);
  const date = planDate(tab, today);
  const planned = items
    .filter((item) => item.date === date)
    .reduce((sum, item) => sum + item.minutes, 0);
  const budget = planningBudget();
  const count = items.filter((item) => item.date === date && !item.done).length;
  const format = (value) => new Intl.NumberFormat(language.replaceAll('_', '-')).format(value);
  const remove = async (task) => {
    const snapshot = {
      task,
      index: items.findIndex((item) => item.id === task.id),
      profile: localStorage.getItem('profileRevision'),
    };
    if (await change((current) => removePlanTask(current, task.id, task.revision))) {
      setDeleted(snapshot);
      setEditing(null);
    }
  };
  return (
    <WidgetShell
      widget="planning"
      title={uiText('planning_title')}
      className="planningWidget"
      error={error}
    >
      <div className="planningTabs" role="group" aria-label={uiText('planning_day')}>
        {['today', 'tomorrow', 'later'].map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {uiText(`planning_${value}`)}
          </button>
        ))}
      </div>
      {date && (
        <div className="planningDay">
          <input
            type="date"
            aria-label={uiText('planning_pick_day')}
            value={date}
            onChange={(e) => {
              if (e.target.value) setTab(e.target.value);
            }}
          />
          <span>{uiText('planning_tasks_count', { count })}</span>
        </div>
      )}
      {damaged ? (
        <p role="alert" className="planningEmpty">
          {uiText('planning_error_damaged')}
        </p>
      ) : (
        <>
          <PlanningCapture {...{ date, today, change, pending }} />
          {date && planned > 0 && (
            <p className="planningSummary">
              {uiText(budget ? 'planning_budget_summary' : 'planning_time_summary', {
                planned: format(planned),
                budget: format(budget),
              })}
              {budget > 0 && planned > budget && (
                <small>
                  {uiText('planning_over_budget', { minutes: format(planned - budget) })}
                </small>
              )}
            </p>
          )}
          <PlanningList {...{ items, date, today, change, pending }} onEdit={setEditing} />
          {deleted && (
            <p className="planningUndo" role="status">
              {uiText('planning_removed')}{' '}
              <button
                type="button"
                disabled={pending}
                onClick={async () => {
                  if (
                    await change((current) => {
                      if (localStorage.getItem('profileRevision') !== deleted.profile)
                        throw new Error('changed');
                      return restorePlanTask(current, deleted.task, deleted.index);
                    })
                  )
                    setDeleted(null);
                }}
              >
                {uiText('planning_undo')}
              </button>
            </p>
          )}
        </>
      )}
      {editing && (
        <PlanningDialog
          task={editing}
          {...{ today, change, pending, error }}
          onClose={() => setEditing(null)}
          onRemove={remove}
        />
      )}
    </WidgetShell>
  );
}

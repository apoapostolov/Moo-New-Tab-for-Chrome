import { useId, useState } from 'react';
import Dialog from '../google/components/Dialog';
import { uiText } from 'lib/translations';
import { changePlanTask, reorderPlanTask } from './planningActions';
import { nextPlanDay } from './planningDates';
import { parsePlanWhen } from './planningNatural';

export default function PlanningDialog({ task, today, change, pending, error, onClose, onRemove }) {
  const [draft, setDraft] = useState(task);
  const [armed, setArmed] = useState(false);
  const [when, setWhen] = useState(task.date || '');
  const [invalid, setInvalid] = useState(false);
  const id = useId();
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  const save = async (delta = 0) => {
    if (!document.getElementById(id).reportValidity()) return;
    const parsed = parsePlanWhen(when, today);
    if (!parsed.valid) {
      setInvalid(true);
      return;
    }
    const patch = {
      title: draft.title.trim(),
      notes: draft.notes.trim(),
      date: parsed.date,
      minutes: Number(draft.minutes),
      priority: parsed.date !== null && draft.priority,
    };
    if (
      await change((items) => {
        const updated = changePlanTask(items, task.id, task.revision, patch);
        return delta ? reorderPlanTask(updated, task.id, task.revision + 1, delta) : updated;
      })
    )
      onClose();
  };
  return (
    <Dialog
      title={uiText('planning_edit')}
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            className="gwButton"
            disabled={pending}
            onClick={() => {
              if (!armed) setArmed(true);
              else onRemove(task);
            }}
          >
            {uiText(armed ? 'planning_confirm_delete' : 'planning_delete')}
          </button>
          <span className="gwSpacer" />
          <button type="button" className="gwButton" onClick={onClose}>
            {uiText('portfolio_cancel')}
          </button>
          <button type="submit" form={id} className="gwButton primary" disabled={pending}>
            {uiText('planning_save')}
          </button>
        </>
      }
    >
      <form
        id={id}
        className="gwForm planningForm"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <label>
          {uiText('field_title')}
          <input
            required
            maxLength={200}
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
          />
        </label>
        <label>
          {uiText('planning_day')}
          <select
            value={draft.date || ''}
            onChange={(e) => {
              setWhen(e.target.value);
              setInvalid(false);
              setDraft((current) => ({
                ...current,
                date: e.target.value || null,
                priority: false,
              }));
            }}
          >
            <option value="">{uiText('planning_later')}</option>
            <option value={today}>{uiText('planning_today')}</option>
            <option value={nextPlanDay(today)}>{uiText('planning_tomorrow')}</option>
            {draft.date && ![today, nextPlanDay(today)].includes(draft.date) && (
              <option value={draft.date}>{draft.date}</option>
            )}
          </select>
        </label>
        <label>
          {uiText('planning_when')}
          <input
            type="text"
            value={when}
            placeholder="today, tomorrow, in 3 days"
            aria-invalid={invalid || undefined}
            onChange={(e) => {
              setWhen(e.target.value);
              setInvalid(false);
              const parsed = parsePlanWhen(e.target.value, today);
              if (parsed.valid)
                setDraft((current) => ({ ...current, date: parsed.date, priority: false }));
            }}
          />
        </label>
        <p className="planningHelp">{uiText('planning_when_hint')}</p>
        <label>
          {uiText('planning_estimate')}
          <input
            type="number"
            min="0"
            max="1440"
            step="1"
            value={draft.minutes}
            onChange={(e) => set('minutes', e.target.value)}
          />
        </label>
        <label>
          {uiText('planning_notes')}
          <textarea
            rows={3}
            maxLength={2000}
            value={draft.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </label>
        <label className="planningPriorityField">
          <input
            type="checkbox"
            checked={draft.priority}
            disabled={!draft.date}
            onChange={(e) => set('priority', e.target.checked)}
          />
          {uiText('planning_priority')}
        </label>
        <p className="planningHelp">{uiText('planning_priority_hint')}</p>
        {(invalid || error) && (
          <p role="alert" className="planningHelp">
            {invalid ? uiText('planning_error_date') : error}
          </p>
        )}
        <div className="planningReorder">
          <button className="gwButton" type="button" disabled={pending} onClick={() => save(-1)}>
            {uiText('planning_move_up')}
          </button>
          <button className="gwButton" type="button" disabled={pending} onClick={() => save(1)}>
            {uiText('planning_move_down')}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

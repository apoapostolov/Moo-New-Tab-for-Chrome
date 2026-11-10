import { useId, useState } from 'react';
import { MdAdd } from 'react-icons/md';
import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { addPlanTask } from './planningActions';
import { parsePlanInput } from './planningNatural';

export default function PlanningCapture({ date, today, change, pending }) {
  const { language } = useTranslationVersion();
  const [text, setText] = useState('');
  const helpId = useId();
  const parsed = parsePlanInput(text, date, today);
  const day = parsed.date
    ? new Intl.DateTimeFormat(language.replaceAll('_', '-'), { dateStyle: 'medium' }).format(
        new Date(`${parsed.date}T12:00:00`),
      )
    : uiText('planning_later');
  return (
    <>
      <form
        className="planningCapture"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!parsed.title || parsed.ambiguous || parsed.invalid) return;
          if (
            await change((items) => addPlanTask(items, { title: parsed.title, date: parsed.date }))
          )
            setText((current) => (current === text ? '' : current));
        }}
      >
        <input
          aria-label={uiText('planning_add')}
          placeholder={uiText('planning_placeholder')}
          value={text}
          maxLength={200}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={helpId}
        />
        <button
          type="submit"
          disabled={pending || !parsed.title || parsed.ambiguous || parsed.invalid}
          aria-label={uiText('planning_add')}
        >
          <MdAdd />
        </button>
      </form>
      <p className="planningCaptureHint" id={helpId} aria-live="polite">
        {parsed.invalid
          ? uiText('planning_error_date')
          : parsed.ambiguous
            ? uiText('planning_error_ambiguous')
            : parsed.explicit
              ? `${day} · ${parsed.title}`
              : uiText('planning_natural_hint')}
      </p>
    </>
  );
}

import { useEffect, useState } from 'react';
import { Header, Group, Row, Content, Action } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { OptionInput } from '../widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import usePlanning from './usePlanning';
import { clearCompletedPlanning } from './planningActions';

export default function PlanningOptions() {
  useTranslationVersion();
  const { items, change, pending, damaged, error } = usePlanning();
  const [armed, setArmed] = useState(null);
  const completed = items.filter((item) => item.done);
  useEffect(() => {
    if (!armed) return undefined;
    const timer = setTimeout(() => setArmed(null), 4000);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <>
      <Header
        title={uiText('planning_title')}
        setting="planningEnabled"
        category="widgets"
        visibilityToggle
      />
      <Group>
        <Row>
          <Content title={uiText('planning_about')} subtitle={uiText('planning_about_hint')} />
        </Row>
        <WidgetSurface setting="surfacePlanning" category="planning" />
        <OptionInput
          category="planning"
          name="planningBudget"
          title={uiText('planning_budget')}
          hint={uiText('planning_budget_hint')}
          type="number"
          min="0"
          max="1440"
          step="1"
          validate={(value) =>
            value !== '' &&
            Number.isInteger(Number(value)) &&
            Number(value) >= 0 &&
            Number(value) <= 1440
          }
        />
      </Group>
      <Group>
        <Row>
          <Content title={uiText('planning_history')} subtitle={uiText('planning_history_hint')} />
          <Action>
            <button
              className="featureButton"
              type="button"
              disabled={pending || damaged || completed.length === 0}
              onClick={async () => {
                if (!armed) {
                  setArmed(completed);
                  return;
                }
                await change((current) => clearCompletedPlanning(current, armed));
                setArmed(null);
              }}
            >
              {uiText(armed ? 'planning_confirm_clear' : 'planning_clear_completed', {
                count: armed ? armed.length : completed.length,
              })}
            </button>
          </Action>
        </Row>
        {error && (
          <Row>
            <p role="alert">{error}</p>
          </Row>
        )}
      </Group>
    </>
  );
}

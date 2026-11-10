import { useEffect, useState } from 'react';
import EventBus from 'utils/eventbus';
import { Header, Group, Row, Content } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { OptionSelect, OptionInput } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { readKnowledgeSettings, KNOWLEDGE_SOURCES, KNOWLEDGE_MODES } from './knowledgeSettings';

export default function KnowledgeOptions() {
  useTranslationVersion();
  const [mode, setMode] = useState(() => readKnowledgeSettings().mode);
  useEffect(() => {
    const sync = () => setMode(readKnowledgeSettings().mode);
    EventBus.on('refresh', sync);
    window.addEventListener('storage', sync);
    return () => {
      EventBus.off('refresh', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  const choices = (values, prefix) =>
    values.map((value) => ({ value, text: uiText(`${prefix}_${value}`) }));
  return (
    <>
      <Header
        title={uiText('knowledge_title')}
        setting="knowledgeEnabled"
        category="widgets"
        visibilityToggle
      />
      <Group>
        <Row>
          <Content title={uiText('knowledge_about')} subtitle={uiText('knowledge_about_hint')} />
        </Row>
        <WidgetSurface setting="surfaceKnowledge" category="knowledge" />
        <OptionSelect
          category="knowledge"
          name="knowledgeSource"
          title={uiText('knowledge_source')}
          items={choices(KNOWLEDGE_SOURCES, 'knowledge')}
        />
        <OptionSelect
          category="knowledge"
          name="knowledgeLanguage"
          title={uiText('knowledge_language')}
          hint={uiText('knowledge_language_hint')}
          items={[
            ['en', 'English'],
            ['bg', 'Български'],
            ['de', 'Deutsch'],
            ['es', 'Español'],
            ['fr', 'Français'],
            ['it', 'Italiano'],
            ['pt', 'Português'],
            ['ja', '日本語'],
            ['nl', 'Nederlands'],
            ['pl', 'Polski'],
            ['uk', 'Українська'],
          ].map(([value, text]) => ({ value, text }))}
        />
        <OptionInput
          category="knowledge"
          name="knowledgeSubjects"
          title={uiText('knowledge_subjects')}
          hint={uiText('knowledge_subjects_hint')}
          placeholder="astronomy, architecture, ancient history"
          maxLength={2000}
          multiline
          validate={(value) =>
            value.split(',').filter((item) => item.trim()).length <= 20 &&
            value.split(',').every((item) => item.trim().length <= 100)
          }
        />
        <OptionSelect
          category="knowledge"
          name="knowledgeMode"
          title={uiText('knowledge_schedule')}
          hint={uiText('knowledge_schedule_hint')}
          items={choices(KNOWLEDGE_MODES, 'knowledge_mode')}
        />
        {mode === 'hours' && (
          <OptionInput
            category="knowledge"
            name="knowledgeHours"
            title={uiText('knowledge_hours')}
            type="number"
            min="1"
            max="168"
            step="1"
            validate={(value) =>
              value !== '' &&
              Number.isInteger(Number(value)) &&
              Number(value) >= 1 &&
              Number(value) <= 168
            }
          />
        )}
      </Group>
    </>
  );
}

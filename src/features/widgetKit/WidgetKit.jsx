import { useId, useState } from 'react';
import { MdRefresh, MdSettings } from 'react-icons/md';
import WidgetCard from 'components/Elements/WidgetCard/WidgetCard';
import { Row, Content, Action } from 'components/Layout/Settings';
import { Dropdown, Switch } from 'components/Form/Settings';
import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import EventBus from 'utils/eventbus';
import { updateHash } from 'utils/deepLinking';
import 'features/google/google.scss';
import 'scss/features.scss';
import 'components/Form/Settings/Text/Text.scss';
import './widgetKit.scss';
import { WidgetTitleLink } from './WidgetTitleLink';

export { WidgetTitleLink } from './WidgetTitleLink';

export const openWidgetSettings = (widget) => {
  updateHash(`#settings/${widget === 'drive' ? 'google' : widget}`);
  EventBus.emit('modal', 'openMainModal');
};

export function IconButton({ label, children, ...props }) {
  return (
    <button
      type="button"
      className="gwIconButton wkIcon"
      title={label}
      aria-label={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function WidgetShell({
  widget,
  title,
  children,
  actions,
  onRefresh,
  loading,
  error,
  updated,
  className = '',
  showSettings = true,
  titleHref,
}) {
  const { language } = useTranslationVersion();
  return (
    <WidgetCard
      as="section"
      aria-label={title}
      widget={widget}
      className={`googleWidget wkCard ${className}`}
      aria-busy={loading || undefined}
    >
      <header className="gwHead">
        <span className="gwLabel">
          {titleHref ? <WidgetTitleLink href={titleHref}>{title}</WidgetTitleLink> : title}
        </span>
        {actions}
        {onRefresh && (
          <IconButton label={uiText('widget_refresh')} onClick={onRefresh} disabled={loading}>
            <MdRefresh />
          </IconButton>
        )}
        {showSettings && (
          <IconButton label={uiText('widget_settings')} onClick={() => openWidgetSettings(widget)}>
            <MdSettings />
          </IconButton>
        )}
      </header>
      {error && (
        <p className="wkNotice" role="status">
          {error}
        </p>
      )}
      {children}
      {updated && (
        <time className="wkUpdated" dateTime={new Date(updated).toISOString()}>
          {uiText('widget_updated', {
            time: new Date(updated).toLocaleTimeString(language.replaceAll('_', '-'), {
              hour: '2-digit',
              minute: '2-digit',
            }),
          })}
        </time>
      )}
    </WidgetCard>
  );
}

export function EmptyState({ widget, children, onAction, actionLabel }) {
  return (
    <div className="googleWidgetEmpty wkEmpty">
      <p>{children}</p>
      <button
        className="gwButton"
        type="button"
        onClick={onAction || (() => openWidgetSettings(widget))}
      >
        {actionLabel || uiText('widget_settings')}
      </button>
    </div>
  );
}

export function OptionToggle({ category, name, title, hint, onChange }) {
  return (
    <Row>
      <Content title={title} subtitle={hint} />
      <Action>
        <Switch name={name} category={category} stateText onChange={onChange} />
      </Action>
    </Row>
  );
}

export function OptionSelect({ category, name, title, hint, items, onChange }) {
  return (
    <Row>
      <Content title={title} subtitle={hint} />
      <Action>
        <Dropdown name={name} category={category} items={items} onChange={onChange} />
      </Action>
    </Row>
  );
}

export function OptionInput({
  category,
  name,
  title,
  hint,
  type = 'text',
  multiline = false,
  validate,
  onSave,
  ...props
}) {
  const id = useId();
  const [draft, setDraft] = useState(() => localStorage.getItem(name) || '');
  const [error, setError] = useState(false);
  const inputProps = {
    id,
    value: draft,
    'aria-label': title,
    'aria-invalid': error || undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
    onChange: (event) => {
      setDraft(event.target.value);
      setError(false);
    },
    onBlur: () => {
      const value = draft.trim();
      if (validate && !validate(value)) {
        setError(true);
        return;
      }
      try {
        localStorage.setItem(name, value);
        if (name === 'githubToken') localStorage.removeItem('githubCache');
        onSave?.(value);
        EventBus.emit('refresh', category);
      } catch {
        setError(true);
      }
    },
    ...props,
  };
  return (
    <Row>
      <Content title={title} subtitle={hint} />
      <Action>
        <div className="text-field-container wkSettingInput">
          <div className="text-field">
            {multiline ? (
              <textarea className="text-field-textarea" rows={3} {...inputProps} />
            ) : (
              <input className="text-field-input" type={type} autoComplete="off" {...inputProps} />
            )}
          </div>
          {error && (
            <p role="alert" id={`${id}-error`}>
              {uiText('widget_invalid_setting')}
            </p>
          )}
        </div>
      </Action>
    </Row>
  );
}

export const numberChoices = (values, unit = '') =>
  values.map((value) => ({ value: String(value), text: `${value}${unit ? ` ${unit}` : ''}` }));

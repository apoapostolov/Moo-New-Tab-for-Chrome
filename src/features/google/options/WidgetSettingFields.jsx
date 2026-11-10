import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useEffect, useState } from 'react';

import {
  MdInbox,
  MdPeople,
  MdLocalOffer,
  MdNotifications,
  MdForum,
  MdFolder,
} from 'react-icons/md';

import EventBus from 'utils/eventbus';

import { Row, Content, Action } from 'components/Layout/Settings/Item';
import { Dropdown } from 'components/Form/Settings';

import { listCalendars } from '../services/calendar';
import { listLabels } from '../services/gmail';
import { listTaskLists } from '../services/tasks';
import {
  MAIL_CATEGORIES,
  readCalendarIds,
  readMailCategories,
  readMailFolders,
  readPrimaryCalendar,
} from '../settings';

const CATEGORY_ICONS = {
  primary: MdInbox,
  social: MdPeople,
  promotions: MdLocalOffer,
  updates: MdNotifications,
  forums: MdForum,
};

const options = (list) => list.map((entry) => ({ value: entry.value, text: entry.label }));

const MAX_EVENTS = [
  { value: '5', label: '5 events' },
  { value: '8', label: '8 events' },
  { value: '12', label: '12 events' },
  { value: '20', label: '20 events' },
  { value: '50', label: '50 events' },
];

const MAX_ITEMS = [
  { value: '5', label: '5 items' },
  { value: '10', label: '10 items' },
  { value: '20', label: '20 items' },
  { value: '50', label: '50 items' },
];

const MAX_MAIL = [
  { value: '3', label: '3 messages' },
  { value: '6', label: '6 messages' },
  { value: '10', label: '10 messages' },
  { value: '20', label: '20 messages' },
];

const Section = ({ title, subtitle, children }) => (
  <Row>
    <Content title={title} subtitle={subtitle} />
    <Action>{children}</Action>
  </Row>
);

/**
 * Calendars are a checkbox list, not a picker: a picker holding one value cannot express
 * "work and family but not birthdays".
 */
const CalendarPicker = () => {
  useTranslationVersion();
  const [calendars, setCalendars] = useState([]);
  const [selected, setSelected] = useState(readCalendarIds);
  const [primary, setPrimary] = useState(readPrimaryCalendar);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listCalendars()
      .then(setCalendars)
      .catch(() => setFailed(true));
  }, []);

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];

    setSelected(next);
    localStorage.setItem('googleCalendarIds', JSON.stringify(next));
    // The widgets listen for this category through the same bus the settings screen uses.
    EventBus.emit('refresh', 'google');
  };

  /**
   * Only one calendar can be the start calendar, so ticking a second moves the mark. Ticking the
   * marked one clears it, and the next new event opens on whichever calendar was used last.
   */
  const pickPrimary = (id) => {
    const next = primary === id ? '' : id;

    setPrimary(next);
    localStorage.setItem('googlePrimaryCalendar', next);
  };

  if (failed) {
    return (
      <p className="gwEmpty">{uiText('calendars_could_not_be_listed_disconnect_and_a35520')}</p>
    );
  }

  if (!calendars.length)
    return <p className="gwEmpty">{uiText('reading_your_calendars_e7d8b6')}</p>;

  return (
    <div className="gwCalendarPicker">
      {calendars.map((calendar) => {
        const writable = calendar.accessRole === 'owner' || calendar.accessRole === 'writer';

        return (
          // The row is not one label any more: a tick inside it would otherwise also switch the
          // calendar on or off.
          <div key={calendar.id} className="gwCalendarOption">
            <label className="gwCalendarTick">
              <input
                type="checkbox"
                checked={selected.includes(calendar.id)}
                onChange={() => toggle(calendar.id)}
              />
              <span
                className="gwDot"
                style={calendar.color ? { background: calendar.color } : {}}
              />
              <span className="gwCalendarName">{calendar.summary}</span>
              {calendar.primary && <span className="gwMuted">{uiText('primary_e3b7c9')}</span>}
            </label>
            <input
              type="checkbox"
              className="gwPrimaryTick"
              checked={primary === calendar.id}
              onChange={() => pickPrimary(calendar.id)}
              disabled={!writable}
              aria-label={`Start new events in ${calendar.summary}`}
              title={writable ? 'New events start here' : 'This calendar is read-only'}
            />
          </div>
        );
      })}
      <span className="gwMuted">
        {selected.length
          ? 'Only the ticked calendars are shown.'
          : 'Nothing ticked: only the primary calendar is shown.'}
      </span>
      <span className="gwMuted">
        {uiText('the_box_on_the_right_is_the_calendar_new_even_2286a9')}
      </span>
    </div>
  );
};

/** One reusable tick list for the mail categories and the labels. */
const OptionTicks = ({ options, selected, onToggle, empty }) => {
  useTranslationVersion();
  if (!options.length) return <p className="gwEmpty">{empty}</p>;

  return (
    <div className="gwOptionList">
      {options.map((option) => {
        const Icon = option.icon;

        return (
          <label key={option.id} className="gwOption">
            <input
              type="checkbox"
              checked={selected.includes(option.id)}
              onChange={() => onToggle(option.id)}
            />
            {Icon && <Icon className="gwOptionIcon" />}
            <span className="gwOptionName">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
};

const CategoryPicker = () => {
  useTranslationVersion();
  const [selected, setSelected] = useState(readMailCategories);

  const toggle = (id) => {
    const next = selected.includes(id)
      ? selected.filter((entry) => entry !== id)
      : [...selected, id];

    setSelected(next);
    localStorage.setItem('googleMailCategories', JSON.stringify(next));
    EventBus.emit('refresh', 'google');
  };

  return (
    <OptionTicks
      options={MAIL_CATEGORIES.map((category) => ({
        ...category,
        icon: CATEGORY_ICONS[category.id],
      }))}
      selected={selected}
      onToggle={toggle}
      empty="No categories."
    />
  );
};

const FolderPicker = () => {
  useTranslationVersion();
  const [labels, setLabels] = useState([]);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(readMailFolders);

  useEffect(() => {
    listLabels()
      .then(setLabels)
      .catch(() => setFailed(true));
  }, []);

  const selectedIds = selected.map((folder) => (typeof folder === 'string' ? folder : folder.id));

  const toggle = (label) => {
    const next = selectedIds.includes(label.id)
      ? selected.filter((folder) => (typeof folder === 'string' ? folder : folder.id) !== label.id)
      : [...selected, { id: label.id, name: label.name }];

    setSelected(next);
    localStorage.setItem('googleMailFolders', JSON.stringify(next));
    EventBus.emit('refresh', 'google');
  };

  if (failed) {
    return (
      <p className="gwEmpty">{uiText('folders_could_not_be_read_reconnect_google_an_a7fcda')}</p>
    );
  }

  return (
    <OptionTicks
      options={labels.map((label) => ({ id: label.id, label: label.display, icon: MdFolder }))}
      selected={selectedIds}
      onToggle={(id) => toggle(labels.find((label) => label.id === id))}
      empty="Reading your folders…"
    />
  );
};

const TaskListPicker = () => {
  useTranslationVersion();
  const [lists, setLists] = useState([]);

  useEffect(() => {
    listTaskLists()
      .then(setLists)
      .catch(() => setLists([]));
  }, []);

  if (lists.length < 2) {
    return <span className="gwMuted">{lists[0]?.title ?? 'Your default task list'}</span>;
  }

  return (
    <Dropdown
      name="googleTasksList"
      category="google"
      items={lists.map((list) => ({ value: list.id, text: list.title }))}
    />
  );
};

export {
  options,
  MAX_EVENTS,
  MAX_ITEMS,
  MAX_MAIL,
  Section,
  CalendarPicker,
  CategoryPicker,
  FolderPicker,
  TaskListPicker,
};

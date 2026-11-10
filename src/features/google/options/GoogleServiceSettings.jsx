import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { Fragment } from 'react';
import { Row, Content, Action } from 'components/Layout/Settings/Item';
import { Checkbox, Dropdown, Text } from 'components/Form/Settings';
import DriveOptions from '../drive/DriveOptions';
import {
  CALENDAR_RANGES,
  TASK_DATE_STYLES,
  MAIL_QUERIES,
  REFRESH_OPTIONS,
  TASK_SORTS,
} from '../settings';
import {
  options,
  MAX_EVENTS,
  MAX_ITEMS,
  MAX_MAIL,
  Section,
  CalendarPicker,
  CategoryPicker,
  FolderPicker,
  TaskListPicker,
} from './WidgetSettingFields';

export default function GoogleServiceSettings({ tab }) {
  useTranslationVersion();
  if (!tab) return null;
  if (tab === 'drive') return <DriveOptions />;

  if (tab === 'calendar') {
    return (
      <Fragment key={tab}>
        <Row>
          <Content
            title={uiText('calendars_shown_0b1365')}
            subtitle={uiText('choose_which_calendars_appear_on_your_page_07fd10')}
          />
          <Action>
            <CalendarPicker />
          </Action>
        </Row>
        <Section
          title={uiText('range_a16c5b')}
          subtitle={uiText('how_far_ahead_the_widget_looks_feda5c')}
        >
          <Dropdown name="googleCalendarRange" category="google" items={options(CALENDAR_RANGES)} />
        </Section>
        <Section
          title={uiText('events_shown_57f3eb')}
          subtitle={uiText('the_most_events_to_show_at_once_6546bc')}
        >
          <Dropdown name="googleCalendarMax" category="google" items={options(MAX_EVENTS)} />
        </Section>
        <Section
          title={uiText('event_details_bc2a9c')}
          subtitle={uiText('choose_which_details_to_show_with_each_event_211d3b')}
        >
          <Checkbox name="googleCalendarLocation" text="Location" category="google" />
          <Checkbox name="googleCalendarNotes" text="Notes" category="google" />
          <Checkbox name="googleCalendarDeclined" text="Declined events" category="google" />
          <Checkbox name="googleCalendarHideAllDay" text="Hide all-day events" category="google" />
        </Section>
        <Section
          title={uiText('layout_972ad8')}
          subtitle={uiText('choose_how_to_group_events_and_show_their_tim_268cbd')}
        >
          <Checkbox name="googleCalendarGroup" text="Group by day" category="google" />
          <Checkbox name="googleCalendar24Hour" text="24-hour times" category="google" />
        </Section>
        <Section
          title={uiText('refresh_56e3ba')}
          subtitle={uiText('how_often_to_check_for_updates_e7f165')}
        >
          <Dropdown
            name="googleCalendarRefresh"
            category="google"
            items={options(REFRESH_OPTIONS)}
          />
        </Section>
      </Fragment>
    );
  }

  if (tab === 'tasks') {
    return (
      <Fragment key={tab}>
        <Row>
          <Content
            title={uiText('task_list_91c40a')}
            subtitle={uiText('choose_where_to_view_and_add_tasks_a2c6f1')}
          />
          <Action>
            <TaskListPicker />
          </Action>
        </Row>
        <Section
          title={uiText('sorting_378e9e')}
          subtitle={uiText('choose_the_order_of_your_tasks_1c693d')}
        >
          <Dropdown name="googleTasksSort" category="google" items={options(TASK_SORTS)} />
          <Checkbox name="googleTasksGroup" text="Group by due date" category="google" />
        </Section>
        <Section
          title={uiText('filtering_9075ed')}
          subtitle={uiText('what_is_left_out_of_the_list_78c20b')}
        >
          <Checkbox name="googleTasksCompleted" text="Show completed tasks" category="google" />
          <Checkbox
            name="googleTasksHideUndated"
            text="Hide tasks without a date"
            category="google"
          />
        </Section>
        <Section
          title={uiText('due_dates_1e24cb')}
          subtitle={uiText('written_as_a_countdown_or_as_a_date_13a7f9')}
        >
          <Dropdown
            name="googleTasksDateStyle"
            category="google"
            items={options(TASK_DATE_STYLES)}
          />
        </Section>
        <Section title={uiText('details_dc3dec')} subtitle={uiText('what_each_row_shows_c9f5b1')}>
          <Checkbox name="googleTasksNotes" text="Notes" category="google" />
          <Dropdown name="googleTasksMax" category="google" items={options(MAX_ITEMS)} />
        </Section>
        <Section
          title={uiText('refresh_56e3ba')}
          subtitle={uiText('how_often_to_check_for_updates_e7f165')}
        >
          <Dropdown name="googleTasksRefresh" category="google" items={options(REFRESH_OPTIONS)} />
        </Section>
      </Fragment>
    );
  }

  return (
    <Fragment key={tab}>
      <Row>
        <Content
          title={uiText('inbox_categories_41ffe8')}
          subtitle={uiText('show_messages_from_these_gmail_categories_unt_9e4fb0')}
        />
        <Action>
          <CategoryPicker />
        </Action>
      </Row>
      <Row>
        <Content
          title={uiText('folders_and_labels_3d61b8')}
          subtitle={uiText('include_messages_from_these_folders_and_label_35adee')}
        />
        <Action>
          <FolderPicker />
        </Action>
      </Row>
      <Section
        title={uiText('filter_d7decf')}
        subtitle={uiText('which_messages_the_widget_lists_cb527b')}
      >
        <Dropdown name="googleMailQuery" category="google" items={options(MAIL_QUERIES)} />
      </Section>
      <Row>
        <Content
          title={uiText('custom_search_c6246f')}
          subtitle={uiText('overrides_the_filter_above_try_from_ana_examp_b68846')}
        />
        <Action>
          <Text
            name="googleMailCustomQuery"
            title={uiText('gmail_search_58ae54')}
            placeholder={uiText('from_ana_example_com_522bd1')}
            category="google"
          />
        </Action>
      </Row>
      <Section
        title={uiText('messages_shown_d051d6')}
        subtitle={uiText('the_most_messages_to_show_at_once_641f05')}
      >
        <Dropdown name="googleMailMax" category="google" items={options(MAX_MAIL)} />
      </Section>
      <Section
        title={uiText('first_line_ce405c')}
        subtitle={uiText('show_the_sender_or_the_subject_first_1850d5')}
      >
        <Dropdown
          name="googleMailPrimary"
          category="google"
          items={[
            { value: 'sender', text: 'Sender first' },
            { value: 'subject', text: 'Subject first' },
          ]}
        />
      </Section>
      <Section
        title={uiText('detail_7c9a7c')}
        subtitle={uiText('extra_text_and_the_unread_indicator_425e7c')}
      >
        <Checkbox name="googleMailSnippet" text="Preview text" category="google" />
        <Dropdown
          name="googleMailBadge"
          category="google"
          items={[
            { value: 'count', text: 'Unread count' },
            { value: 'dot', text: 'Unread dot' },
            { value: 'hidden', text: 'No indicator' },
          ]}
        />
      </Section>
      <Section
        title={uiText('refresh_56e3ba')}
        subtitle={uiText('how_often_to_check_for_updates_e7f165')}
      >
        <Dropdown name="googleMailRefresh" category="google" items={options(REFRESH_OPTIONS)} />
      </Section>
    </Fragment>
  );
}

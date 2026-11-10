import { useTranslationVersion } from 'contexts/TranslationContext';
import { memo, useMemo } from 'react';
import { useT } from 'contexts/TranslationContext';

import Tabs from 'components/Elements/MainModal/backend/Tabs';
import { SHOW_EXPERIMENTAL } from 'config/constants';

import { NavbarOptions } from 'features/navbar';
import { TimeOptions } from 'features/time';
import { QuickLinksOptions } from 'features/quicklinks';
import { BackgroundOptions } from 'features/background';
import { WeatherOptions } from 'features/weather';
import { GoogleOptions } from 'features/google';
import { RssOptions } from 'features/rss';
import FocusOptions from 'features/focus/FocusOptions';
import PortfolioOptions from 'features/portfolio/PortfolioOptions';
import HabitOptions from 'features/habits/HabitOptions';
import AirQualityOptions from 'features/airquality/AirQualityOptions';
import BookmarkOptions from 'features/bookmarks/BookmarkOptions';
import GitHubOptions from 'features/github/GitHubOptions';
import PlanningOptions from 'features/planning/PlanningOptions';
import { Stats } from 'features/stats';
import {
  About,
  AdvancedOptions,
  AppearanceOptions,
  Changelog,
  ExperimentalOptions,
  LanguageOptions,
  MiscOptions,
  FloatsOptions,
  Overview,
} from '../sections';

const sections = [
  // Core page setup and everyday essentials.
  { label: 'modals.main.marketplace.product.overview', name: 'order', component: Overview },
  {
    label: 'modals.main.settings.sections.background.title',
    name: 'background',
    component: BackgroundOptions,
  },
  {
    label: 'modals.main.settings.sections.appearance.title',
    name: 'appearance',
    component: AppearanceOptions,
  },
  { label: 'modals.main.settings.sections.time.title', name: 'time', component: TimeOptions },
  {
    label: 'modals.main.settings.sections.weather.title',
    name: 'weather',
    component: WeatherOptions,
  },
  {
    label: 'modals.main.settings.sections.quicklinks.title',
    name: 'quicklinks',
    component: QuickLinksOptions,
  },
  {
    label: 'modals.main.settings.sections.appearance.navbar.title',
    name: 'navbar',
    component: NavbarOptions,
  },
  // Optional widgets and productivity tools.
  { label: 'ui.planning_title', name: 'planning', component: PlanningOptions },
  { label: 'ui.focus_title', name: 'focus', component: FocusOptions },
  { label: 'ui.habits_title', name: 'habits', component: HabitOptions },
  { label: 'ui.air_title', name: 'airquality', component: AirQualityOptions },
  {
    label: 'modals.main.settings.sections.google.title',
    name: 'google',
    component: GoogleOptions,
  },
  { label: 'modals.main.settings.sections.floats.title', name: 'floats', component: FloatsOptions },
  { label: 'modals.main.settings.sections.rss.title', name: 'rss', component: RssOptions },
  { label: 'ui.bookmarks_title', name: 'bookmarks', component: BookmarkOptions },
  { label: 'ui.portfolio_title', name: 'portfolio', component: PortfolioOptions },
  { label: 'ui.github_title', name: 'github', component: GitHubOptions },
  {
    label: 'modals.main.settings.sections.misc.title',
    name: 'misc',
    component: MiscOptions,
  },
  // Language, advanced controls and reference screens.
  {
    label: 'modals.main.settings.sections.language.title',
    name: 'language',
    component: LanguageOptions,
  },
  {
    label: 'modals.main.settings.sections.advanced.title',
    name: 'advanced',
    component: AdvancedOptions,
  },
  {
    label: 'modals.main.settings.sections.experimental.title',
    name: 'experimental',
    component: ExperimentalOptions,
  },
  { label: 'modals.main.settings.sections.stats.title', name: 'stats', component: Stats },
  {
    label: 'modals.main.settings.sections.changelog.title',
    name: 'changelog',
    component: Changelog,
  },
  { label: 'modals.main.settings.sections.about.title', name: 'about', component: About },
].filter((section) => SHOW_EXPERIMENTAL || section.name !== 'experimental');

function Settings(props) {
  useTranslationVersion();
  const t = useT();

  const translatedSections = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        translatedLabel: t(section.label),
      })),
    [t],
  );

  return (
    <Tabs
      changeTab={(type) => props.changeTab(type)}
      current="settings"
      currentTab={props.currentTab}
      onSectionChange={props.onSectionChange}
      onSubSectionChange={props.onSubSectionChange}
      currentSubSection={props.currentSubSection}
      deepLinkData={props.deepLinkData}
      navigationTrigger={props.navigationTrigger}
      sections={sections}
    >
      {translatedSections.map(({ name, component: Component, translatedLabel }) => (
        <div key={name} label={translatedLabel} name={name}>
          <Component
            currentSubSection={props.currentSubSection}
            onSubSectionChange={props.onSubSectionChange}
            sectionName={name}
          />
        </div>
      ))}
    </Tabs>
  );
}

export default memo(Settings);

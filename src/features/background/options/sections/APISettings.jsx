import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useEffect, useState } from 'react';
import variables from 'config/variables';
import { Dropdown, Text, ChipSelect } from 'components/Form/Settings';
import { Row, Content, Action } from 'components/Layout/Settings/Item';
import { APIQualityOptions } from '../optionTypes';
import { LIVE_CHANNEL_ANY, readChannels } from '../../api/live';
import { grantMixkit, mixkitAccess } from '../../api/mixkit';
import LiveChannels from './LiveChannels';

const clearPrefetch = () => {
  localStorage.removeItem('imageQueue');
  localStorage.removeItem('videoQueue');
};

const loadingItems = [
  { value: 'loading', text: variables.getMessage('modals.main.loading') },
  { value: 'loading', text: variables.getMessage('modals.main.loading') },
];

const APISettings = ({ backgroundAPI, backgroundCategories, unsplashTopics }) => {
  useTranslationVersion();
  const loading = backgroundCategories[0] === variables.getMessage('modals.main.loading');

  // Mixkit answers no CORS header, so Firefox has to be given its origin before a new tab
  // may read the catalogue. The answer is read here so the row can offer the prompt when it
  // is missing, and again after the prompt, because the answer arrives as a boolean.
  const [mixkit, setMixkit] = useState('unknown');

  useEffect(() => {
    let live = true;

    mixkitAccess().then((state) => {
      if (live) setMixkit(state);
    });

    return () => {
      live = false;
    };
  }, []);

  const allowMixkit = async () => {
    await grantMixkit();
    setMixkit(await mixkitAccess());
  };

  const categoriesControl = (options) =>
    loading ? (
      <Dropdown
        label={variables.getMessage('modals.main.settings.sections.background.category')}
        name="apiCategories"
        items={loadingItems}
      />
    ) : (
      <ChipSelect
        key="apiCategories"
        label={variables.getMessage('modals.main.settings.sections.background.categories')}
        options={options}
        name="apiCategories"
        onChange={clearPrefetch}
      />
    );

  // A loaded topic list becomes chips; until then the dropdown shows the loading state.
  const topicsControl = Array.isArray(unsplashTopics) ? (
    <ChipSelect
      key="unsplashTopics"
      label={variables.getMessage('modals.main.settings.sections.background.unsplash.topics')}
      options={unsplashTopics}
      name="unsplashTopics"
      storageKey="unsplashTopics"
      onChange={clearPrefetch}
    />
  ) : (
    <Dropdown
      label={variables.getMessage('modals.main.settings.sections.background.unsplash.topics')}
      name="unsplashTopics"
      items={loadingItems}
    />
  );

  const qualityControl = (
    <Dropdown
      label={variables.getMessage('modals.main.settings.sections.background.source.quality.title')}
      name="apiQuality"
      element=".other"
      items={APIQualityOptions}
      onChange={clearPrefetch}
    />
  );

  if (backgroundAPI === 'coverr') {
    return (
      <Row final={true}>
        <Content
          title={variables.getMessage('modals.main.settings.sections.background.coverr.title')}
          subtitle={variables.getMessage(
            'modals.main.settings.sections.background.coverr.subtitle',
          )}
        />
        <Action>
          <Text
            title={variables.getMessage('modals.main.settings.sections.background.coverr.search')}
            subtitle={variables.getMessage(
              'modals.main.settings.sections.background.coverr.search_subtitle',
            )}
            placeholder={uiText('e_g_ocean_forest_city_24cef2')}
            name="coverrQuery"
            category="backgroundrefresh"
            onChange={clearPrefetch}
          />
        </Action>
      </Row>
    );
  }

  if (backgroundAPI === 'mixkit') {
    const base = 'modals.main.settings.sections.background.mixkit';

    return (
      <Row final={true}>
        <Content
          title={variables.getMessage(`${base}.title`)}
          subtitle={variables.getMessage(`${base}.subtitle`)}
        />
        <Action>
          {/* Keep the grant action available if Chrome cannot read the permission state. */}
          {mixkit !== 'granted' && (
            <button className="apiAllowButton" type="button" onClick={allowMixkit}>
              {variables.getMessage(`${base}.allow`)}
            </button>
          )}
          <Text
            title={variables.getMessage(`${base}.search`)}
            subtitle={variables.getMessage(`${base}.search_subtitle`)}
            placeholder={uiText('e_g_ink_water_clouds_dd1835')}
            name="mixkitQuery"
            category="backgroundrefresh"
            onChange={clearPrefetch}
          />
        </Action>
      </Row>
    );
  }

  // Pixabay and Pexels both need a key the user creates on their own account.
  const keyedVideoSource = (source) => {
    const base = `modals.main.settings.sections.background.${source}`;

    return (
      <Row final={true}>
        <Content
          title={variables.getMessage(`${base}.title`)}
          subtitle={variables.getMessage(`${base}.subtitle`)}
        />
        <Action>
          <Text
            title={variables.getMessage(`${base}.key`)}
            subtitle={variables.getMessage(`${base}.key_subtitle`)}
            placeholder={variables.getMessage(`${base}.key_placeholder`)}
            name={`${source}Key`}
            category="backgroundrefresh"
            onChange={clearPrefetch}
          />
          <Text
            title={variables.getMessage(`${base}.search`)}
            subtitle={variables.getMessage(`${base}.search_subtitle`)}
            placeholder={uiText('e_g_ocean_forest_city_24cef2')}
            name={`${source}Query`}
            category="backgroundrefresh"
            onChange={clearPrefetch}
          />
        </Action>
      </Row>
    );
  };

  if (backgroundAPI === 'pixabay' || backgroundAPI === 'pexels') {
    return keyedVideoSource(backgroundAPI);
  }

  if (backgroundAPI === 'nasa' || backgroundAPI === 'commons') {
    return (
      <Row final={true}>
        <Content title={backgroundAPI === 'nasa' ? 'NASA' : 'Wikimedia Commons'} />
        <Action>
          <Text
            title={variables.getMessage('modals.main.settings.sections.background.coverr.search')}
            subtitle={variables.getMessage(
              'modals.main.settings.sections.background.coverr.search_subtitle',
            )}
            placeholder={backgroundAPI === 'nasa' ? 'Earth from space' : 'landscape'}
            name={`${backgroundAPI}Query`}
            category="backgroundrefresh"
            onChange={clearPrefetch}
          />
        </Action>
      </Row>
    );
  }

  if (backgroundAPI === 'live') {
    // The list is the profile's, so a renamed channel reads under its new name here.
    const channels = readChannels();
    const liveItems = [
      {
        value: LIVE_CHANNEL_ANY,
        text: variables.getMessage('modals.main.settings.sections.background.live.channel_any'),
      },
      // Alphabetical, by the name as written: thirty channels in the order they were added is
      // a hunt, and this is a picker rather than a list to be arranged. The editor keeps the
      // stored order, because there a drag means something.
      ...[...channels]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((channel) => ({
          value: channel.id,
          text: channel.quality ? `${channel.name} (${channel.quality})` : channel.name,
        })),
    ];

    return (
      <>
        <Row>
          <Content
            title={variables.getMessage('modals.main.settings.sections.background.live.title')}
            subtitle={variables.getMessage(
              'modals.main.settings.sections.background.live.subtitle',
            )}
          />
          <Action>
            <Dropdown
              label={variables.getMessage('modals.main.settings.sections.background.live.channel')}
              name="liveChannel"
              items={liveItems}
              category="backgroundrefresh"
              onChange={clearPrefetch}
            />
          </Action>
        </Row>

        <LiveChannels onChanged={clearPrefetch} />
      </>
    );
  }

  // Unsplash is the fallback panel: a profile with an unknown API value still
  // renders settings rather than a blank section.
  return (
    <Row final={true}>
      <Content
        title={variables.getMessage(
          'modals.main.settings.sections.background.unsplash.section_title',
        )}
        subtitle={variables.getMessage(
          'modals.main.settings.sections.background.unsplash.section_subtitle',
        )}
      />
      <Action>
        {backgroundAPI === 'mue' ? categoriesControl(backgroundCategories) : topicsControl}
        <Text
          title={variables.getMessage('modals.main.settings.sections.background.unsplash.id')}
          subtitle={variables.getMessage(
            'modals.main.settings.sections.background.unsplash.id_subtitle',
          )}
          placeholder="e.g. 123456, 654321"
          name="unsplashCollections"
          category="background"
          element="#backgroundImage"
          onChange={clearPrefetch}
        />
        {qualityControl}
      </Action>
    </Row>
  );
};

export default APISettings;

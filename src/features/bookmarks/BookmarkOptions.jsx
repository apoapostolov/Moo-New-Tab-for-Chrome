import { useEffect, useState } from 'react';
import { Header, Group, Row, Content, Action } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import EventBus from 'utils/eventbus';
import { OptionSelect, OptionInput, OptionToggle, numberChoices } from '../widgetKit/WidgetKit';
import { bookmarkSettings, bookmarkIdentity } from './bookmarkStore';
import { raindropCollections } from './bookmarkProviders';
import { readBookmarkCache, writeBookmarkCache, clearBookmarkCache } from './bookmarkCache';
import { MODES } from './bookmarkSelection';
import BrowserBookmarkOptions from './BrowserBookmarkOptions';

const choices = (values, prefix) =>
  values.map((value) => ({ value, text: uiText(`${prefix}${value}`) }));
export default function BookmarkOptions() {
  useTranslationVersion();
  const [, redraw] = useState(0);
  const settings = bookmarkSettings();
  const token = settings.sources.raindrop.token;
  const [collections, setCollections] = useState([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [rebuild, setRebuild] = useState(false);
  useEffect(() => {
    const changed = (category) => {
      if (category === 'bookmarks') redraw((value) => value + 1);
    };
    EventBus.on('refresh', changed);
    return () => EventBus.off('refresh', changed);
  }, []);
  useEffect(() => {
    let alive = true;
    readBookmarkCache('raindrop')
      .then(async (cache) => {
        if (
          alive &&
          cache?.identity === (await bookmarkIdentity(bookmarkSettings().sources.raindrop))
        )
          setCollections(cache.collections || []);
      })
      .catch(() => {});
    readBookmarkCache('collections')
      .then(async (cache) => {
        if (alive && cache?.identity === (await bookmarkIdentity(token)))
          setCollections(cache.items || []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [token]);
  const loadCollections = async () => {
    setBusy(true);
    setStatus('');
    try {
      const result = await raindropCollections(token);
      if (token === bookmarkSettings().sources.raindrop.token) {
        await writeBookmarkCache('collections', {
          identity: await bookmarkIdentity(token),
          items: result,
        });
        setCollections(result);
      }
    } catch (error) {
      setStatus(
        uiText(
          `bookmarks_error_${['auth', 'rate', 'offline'].includes(error.message) ? error.message : 'network'}`,
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const credentialChanged = (source) => {
    setStatus('');
    if (source === 'raindrop') setCollections([]);
    clearBookmarkCache(source).catch(() => {});
    redraw((n) => n + 1);
  };
  return (
    <>
      <Header
        title={uiText('bookmarks_title')}
        setting="bookmarksEnabled"
        category="widgets"
        visibilityToggle
      />
      <Group>
        <WidgetSurface setting="surfaceBookmarks" category="bookmarks" />
        <OptionSelect
          category="bookmarks"
          name="bookmarksMode"
          title={uiText('bookmarks_mode')}
          hint={uiText('bookmarks_mode_hint')}
          items={choices(MODES, 'bookmarks_mode_')}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksLimit"
          title={uiText('widget_item_limit')}
          items={numberChoices([3, 5, 8, 10, 12])}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksRotation"
          title={uiText('bookmarks_rotation')}
          hint={uiText('bookmarks_rotation_hint')}
          items={choices(['daily', 'session', 'manual'], 'bookmarks_rotation_')}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksRefresh"
          title={uiText('widget_refresh_interval')}
          items={numberChoices([15, 30, 60, 120], uiText('widget_minutes'))}
        />
        <OptionToggle
          category="bookmarks"
          name="bookmarksThumbnails"
          title={uiText('bookmarks_thumbnails')}
        />
        <OptionToggle
          category="bookmarks"
          name="bookmarksOpenReader"
          title={uiText('bookmarks_open_reader')}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksLinkTarget"
          title={uiText('bookmarks_open_links_in')}
          items={[
            { value: '_self', text: uiText('bookmarks_same_tab') },
            { value: '_blank', text: uiText('bookmarks_new_tab') },
          ]}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksTitleDestination"
          title="Open Bookmarks title"
          items={[
            { value: 'browser', text: uiText('bookmarks_browser') },
            { value: 'raindrop', text: 'Raindrop' },
            { value: 'readwise', text: 'Readwise Reader' },
            { value: 'custom', text: 'Other service' },
          ]}
        />
        {settings.titleDestination === 'custom' && (
          <OptionInput
            category="bookmarks"
            name="bookmarksTitleServiceUrl"
            title="Other service URL"
            hint="Leave empty to keep the Bookmarks title unlinked."
            maxLength={2048}
            placeholder="https://example.com/bookmarks"
          />
        )}
      </Group>
      <BrowserBookmarkOptions />
      <Group>
        <Row>
          <Content title="Raindrop" subtitle={uiText('bookmarks_raindrop_hint')} />
        </Row>
        <OptionToggle
          category="bookmarks"
          name="bookmarksRaindropEnabled"
          key={`raindrop-${settings.sources.raindrop.enabled}`}
          title={uiText('bookmarks_use_raindrop')}
        />
        <OptionInput
          category="bookmarks"
          name="bookmarksRaindropToken"
          aria-label={`Raindrop · ${uiText('bookmarks_access_token')}`}
          title={uiText('bookmarks_access_token')}
          type="password"
          maxLength={1000}
          onSave={() => credentialChanged('raindrop')}
        />
        <Row>
          <Content
            subtitle={
              <a
                href="https://app.raindrop.io/settings/integrations"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uiText('bookmarks_raindrop_token')}
              </a>
            }
          />
        </Row>
        <OptionSelect
          category="bookmarks"
          name="bookmarksRaindropCollection"
          title={uiText('bookmarks_collection')}
          items={[
            { value: '0', text: uiText('bookmarks_all_collections') },
            { value: '-1', text: uiText('bookmarks_unsorted') },
            ...collections.map((collection) => ({
              value: String(collection.id),
              text: collection.title,
            })),
            ...(![0, -1, ...collections.map((collection) => collection.id)].includes(
              settings.sources.raindrop.collection,
            )
              ? [
                  {
                    value: String(settings.sources.raindrop.collection),
                    text: `#${settings.sources.raindrop.collection}`,
                  },
                ]
              : []),
          ]}
        />
        <Row>
          <Content subtitle={uiText('bookmarks_collections_hint')} />
          <Action>
            <button
              type="button"
              className="gwButton"
              onClick={loadCollections}
              disabled={!token || busy}
            >
              {uiText(busy ? 'widget_loading' : 'bookmarks_load_collections')}
            </button>
          </Action>
        </Row>
        {status && (
          <Row>
            <Content subtitle={<span role="status">{status}</span>} />
          </Row>
        )}
        <OptionToggle
          category="bookmarks"
          name="bookmarksRaindropNested"
          title={uiText('bookmarks_nested')}
        />
        <OptionInput
          category="bookmarks"
          name="bookmarksRaindropQuery"
          title={uiText('bookmarks_search')}
          hint={uiText('bookmarks_search_hint')}
          maxLength={1000}
          placeholder="#design type:article"
        />
      </Group>
      <Group>
        <Row>
          <Content title="Readwise" subtitle={uiText('bookmarks_readwise_hint')} />
        </Row>
        <OptionToggle
          category="bookmarks"
          name="bookmarksReadwiseEnabled"
          key={`readwise-${settings.sources.readwise.enabled}`}
          title={uiText('bookmarks_use_readwise')}
        />
        <OptionInput
          category="bookmarks"
          name="bookmarksReadwiseToken"
          aria-label={`Readwise · ${uiText('bookmarks_access_token')}`}
          title={uiText('bookmarks_access_token')}
          type="password"
          maxLength={1000}
          onSave={() => credentialChanged('readwise')}
        />
        <Row>
          <Content
            subtitle={
              <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer">
                {uiText('bookmarks_readwise_token')}
              </a>
            }
          />
        </Row>
        <OptionSelect
          category="bookmarks"
          name="bookmarksReadwiseView"
          title={uiText('bookmarks_content')}
          items={choices(['reader', 'review'], 'bookmarks_readwise_')}
          onChange={() => redraw((n) => n + 1)}
        />
        {settings.sources.readwise.view === 'reader' && (
          <>
            <OptionSelect
              category="bookmarks"
              name="bookmarksReadwiseLocation"
              title={uiText('bookmarks_reader_location')}
              items={choices(
                ['queue', 'all', 'new', 'later', 'shortlist', 'archive', 'feed'],
                'bookmarks_location_',
              )}
            />
            <OptionSelect
              category="bookmarks"
              name="bookmarksReadwiseCategory"
              title={uiText('bookmarks_content_type')}
              items={choices(
                ['all', 'article', 'email', 'rss', 'pdf', 'epub', 'tweet', 'video'],
                'bookmarks_type_',
              )}
            />
            <OptionInput
              category="bookmarks"
              name="bookmarksReadwiseTag"
              title={uiText('bookmarks_tag')}
              hint={uiText('bookmarks_tag_hint')}
              maxLength={100}
            />
          </>
        )}
      </Group>
      <Group>
        <Row>
          <Content
            title={uiText('bookmarks_discovery')}
            subtitle={uiText('bookmarks_discovery_hint')}
          />
        </Row>
        <OptionSelect
          category="bookmarks"
          name="bookmarksMinAge"
          title={uiText('bookmarks_age')}
          items={numberChoices([0, 7, 30, 90, 180, 365], uiText('bookmarks_days'))}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksRepeatDays"
          title={uiText('bookmarks_repeat')}
          hint={uiText('bookmarks_repeat_hint')}
          items={numberChoices([0, 7, 30, 90], uiText('bookmarks_days'))}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksDomainLimit"
          title={uiText('bookmarks_domain_limit')}
          items={[{ value: '0', text: uiText('bookmarks_unlimited') }, ...numberChoices([1, 2, 3])]}
        />
        <OptionSelect
          category="bookmarks"
          name="bookmarksMinMinutes"
          title={uiText('bookmarks_min_minutes')}
          hint={uiText('bookmarks_min_minutes_hint')}
          items={numberChoices([0, 5, 10, 20, 30], uiText('widget_minutes'))}
        />
        <OptionToggle
          category="bookmarks"
          name="bookmarksBalance"
          title={uiText('bookmarks_balance')}
        />
        <OptionToggle
          category="bookmarks"
          name="bookmarksHideOpened"
          title={uiText('bookmarks_hide_opened')}
          hint={uiText('bookmarks_hide_opened_hint')}
        />
        <Row>
          <Content
            title={uiText('bookmarks_reset_history')}
            subtitle={uiText('bookmarks_reset_history_hint')}
          />
          <Action>
            <button
              type="button"
              className="gwButton"
              onBlur={() => setConfirm(false)}
              onClick={async () => {
                if (!confirm) {
                  setConfirm(true);
                  return;
                }
                try {
                  await clearBookmarkCache('selection');
                  setConfirm(false);
                  EventBus.emit('refresh', 'bookmarks');
                } catch {
                  setStatus(uiText('bookmarks_error_storage'));
                }
              }}
            >
              {uiText(confirm ? 'bookmarks_confirm_reset' : 'bookmarks_reset')}
            </button>
          </Action>
        </Row>
        <Row>
          <Content subtitle={uiText('bookmarks_privacy')} />
        </Row>
        <Row>
          <Content
            title={uiText('bookmarks_rebuild')}
            subtitle={uiText('bookmarks_rebuild_hint')}
          />
          <Action>
            <button
              type="button"
              className="gwButton"
              onBlur={() => setRebuild(false)}
              onClick={async () => {
                if (!rebuild) {
                  setRebuild(true);
                  return;
                }
                try {
                  await clearBookmarkCache();
                  setCollections([]);
                  setRebuild(false);
                  EventBus.emit('refresh', 'bookmarks');
                } catch {
                  setStatus(uiText('bookmarks_error_storage'));
                }
              }}
            >
              {uiText(rebuild ? 'bookmarks_confirm_rebuild' : 'bookmarks_rebuild_button')}
            </button>
          </Action>
        </Row>
      </Group>
    </>
  );
}

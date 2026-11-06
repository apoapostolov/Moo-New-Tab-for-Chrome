import 'components/Form/Settings/Text/Text.scss';
import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useEffect, useState } from 'react';
import { MdAdd, MdCheck, MdDeleteOutline, MdDownload, MdUpload } from 'react-icons/md';

import { Header, Row, Content, Action, Group } from 'components/Layout/Settings';
import { Checkbox, Dropdown, FileUpload, Text } from 'components/Form/Settings';
import { Button } from 'components/Elements';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import EventBus from 'utils/eventbus';
import { saveFile } from 'utils/saveFile';

import {
  feedAccess,
  feedTitle,
  forgetItems,
  grantAccess,
  mergeFeeds,
  normaliseUrl,
  readFeeds,
  saveFeeds,
} from '../feedStore';
import { buildOpml, opmlFilename, parseOpml } from '../opml';
import {
  budgetState,
  feedlyAccess,
  forgetFeedly,
  grantFeedlyAccess,
  readFeedlyToken,
  verifyFeedly,
} from '../feedly';

const OPML_INPUT = 'rss-opml-input';

// The card lists what the profile asks for, one at a time up to a dozen.
const COUNTS = Array.from({ length: 12 }, (_, index) => String(index + 1));
const REFRESH = ['15', '30', '60', '120'];
// Hours a kept article may sit unused before the page drops it.
const KEEP = [
  { value: '24', text: '1 day' },
  { value: '72', text: '3 days' },
  { value: '168', text: '7 days' },
  { value: '336', text: '14 days' },
];

/**
 * The controls read their stored value when they mount, so the defaults have to be in
 * place before the panel renders. Written in an effect they arrive after it, and a
 * profile that has never touched these shows the first option instead of the default.
 */
const seedDefaults = () => {
  const defaults = {
    rssFullArticle: 'true',
    rssItemCount: '3',
    rssRefreshMinutes: '30',
    rssArticleTtl: '168',
    rssSource: 'feeds',
    rssServiceUrl: 'www.feedly.com/',
  };

  for (const [key, value] of Object.entries(defaults)) {
    if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
  }
};

seedDefaults();

const Section = ({ title, subtitle }) => (
  <Row>
    <Content title={title} subtitle={subtitle} />
  </Row>
);

/**
 * Feeds are one list, and the page draws them as one: the card has no idea which
 * feed a headline came from beyond naming it. Adding a feed asks the browser for
 * access to that host, since a feed on a host the page cannot reach answers nothing.
 */
const RssOptions = () => {
  useTranslationVersion();
  const [feeds, setFeeds] = useState(readFeeds());
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [access, setAccess] = useState({});
  const [feedly, setFeedly] = useState({ status: '', access: 'unknown', busy: false });
  const [transfer, setTransfer] = useState({ status: '', reading: false });
  const [hasToken, setHasToken] = useState(Boolean(readFeedlyToken()));

  useEffect(() => {
    let live = true;

    (async () => {
      const next = {};

      for (const feed of feeds) next[feed.url] = await feedAccess(feed.url);

      if (live) setAccess(next);
    })();

    return () => {
      live = false;
    };
  }, [feeds]);

  const commit = (next) => {
    saveFeeds(next);
    setFeeds(next);
    forgetItems();
    EventBus.emit('refresh', 'rss');
  };

  const add = async () => {
    const url = normaliseUrl(draft);

    if (!url) {
      setError('That does not look like an address.');
      return;
    }

    if (feeds.some((feed) => feed.url === url)) {
      setError('That feed is already in the list.');
      return;
    }

    setError('');

    // Permission has to be asked for inside the click that leads here.
    await grantAccess(url);

    commit([...feeds, { url, title: feedTitle(url) }]);
    setDraft('');
  };

  const allow = async (url) => {
    const granted = await grantAccess(url);
    setAccess((previous) => ({ ...previous, [url]: granted ? 'granted' : 'missing' }));
    forgetItems();
    EventBus.emit('refresh', 'rss');
  };

  const remove = (url) => commit(feeds.filter((feed) => feed.url !== url));

  /**
   * The Feedly side of these settings. A token belongs to one account and Feedly allows
   * 50 calls a day on it, so the page reports both what the token is and what is left.
   */
  useEffect(() => {
    let live = true;

    feedlyAccess().then((state) => {
      if (live) setFeedly((previous) => ({ ...previous, access: state }));
    });

    return () => {
      live = false;
    };
  }, []);

  const checkFeedly = async () => {
    setFeedly((previous) => ({ ...previous, busy: true, status: '' }));

    // Asked here rather than on load: the browser only grants a host from a click.
    const access = (await feedlyAccess()) === 'missing' ? await grantFeedlyAccess() : true;

    if (!access) {
      setFeedly({
        busy: false,
        access: 'missing',
        status: 'Moo needs permission to reach Feedly before it can check the token.',
      });

      return;
    }

    try {
      const profile = await verifyFeedly();

      setFeedly({
        busy: false,
        access: 'granted',
        status: `Connected as ${profile.email || profile.givenName || profile.id}${
          profile.plan ? `, on the ${profile.plan} plan` : ''
        }.`,
      });

      // Only a first connection needs the card to go and fetch: a re-check would spend two
      // calls to redraw a list the cache already holds.
      if (!localStorage.getItem('feedlyItems')) EventBus.emit('refresh', 'rss');
    } catch (failure) {
      setFeedly((previous) => ({ ...previous, busy: false, status: failure.message }));
    }
  };

  const disconnectFeedly = () => {
    forgetFeedly();
    setHasToken(false);
    setFeedly((previous) => ({ ...previous, status: 'Token removed.' }));
    EventBus.emit('refresh', 'rss');
  };

  /**
   * A file the reader exported becomes feeds in this profile. Nothing is fetched here, so
   * every new host shows the same Allow button a hand-added feed shows.
   */
  const importOpml = async (text) => {
    const parsed = parseOpml(text);

    if (parsed.error === 'not_opml') {
      setTransfer({ reading: false, status: 'That file is not an OPML document.' });

      return;
    }

    if (!parsed.feeds.length) {
      setTransfer({ reading: false, status: 'That file has no feeds in it.' });

      return;
    }

    const merged = mergeFeeds(feeds, parsed.feeds);

    saveFeeds(merged.feeds);
    setFeeds(merged.feeds);
    forgetItems();
    EventBus.emit('refresh', 'rss');

    const parts = [`${merged.added} ${merged.added === 1 ? 'feed' : 'feeds'} added`];

    if (merged.duplicates) parts.push(`${merged.duplicates} already here`);
    if (merged.invalid) parts.push(`${merged.invalid} without an address`);
    if (parsed.skipped) parts.push(`${parsed.skipped} repeated in the file`);

    setTransfer({ reading: false, status: `${parts.join(', ')}.` });
  };

  const exportOpml = () => {
    saveFile(buildOpml(feeds), opmlFilename(), 'text/x-opml');
    setTransfer({ reading: false, status: `Saved ${feeds.length} feeds as OPML.` });
  };

  const budget = budgetState();
  const calls = budget
    ? `${budget.used} of ${budget.limit} calls used${
        budget.used
          ? `, ${Math.floor(budget.resetInMinutes / 60)}h ${budget.resetInMinutes % 60}m until they reset`
          : ''
      }.`
    : 'No calls made yet.';

  return (
    <>
      <Header title={uiText('rss_fcae0f')} />

      <Group>
        <Section
          title={uiText('source_6da13a')}
          subtitle={uiText('where_the_card_s_headlines_come_from_both_lis_dfbae5')}
        />

        <Row>
          <Content
            title={uiText('headlines_from_af57a5')}
            subtitle={uiText('the_feeds_added_below_or_a_feedly_account_a2b02e')}
          />
          <Action>
            <Dropdown
              name="rssSource"
              category="rss"
              items={[
                { value: 'feeds', text: uiText('your_feeds_2807e6') },
                { value: 'feedly', text: uiText('a_feedly_account_9ab3eb') },
              ]}
            />
          </Action>
        </Row>

        <Row>
          <Content
            title="Preferred RSS service"
            subtitle="Opened when you select the RSS widget title."
          />
          <Action>
            <Text
              name="rssServiceUrl"
              default="www.feedly.com/"
              category="widgetTitle"
              placeholder="www.feedly.com/"
            />
          </Action>
        </Row>
      </Group>

      <Group>
        <Section
          title={uiText('feeds_ffe8e9')}
          subtitle={uiText('see_stories_from_all_your_feeds_in_one_list_n_0f4b60')}
        />

        {feeds.map((feed) => (
          <Row key={feed.url} className="rssFeedRow">
            <Content
              title={feed.title || feedTitle(feed.url)}
              subtitle={feed.folder ? `${feed.folder} · ${feed.url}` : feed.url}
            />
            <Action>
              {access[feed.url] === 'missing' ? (
                <button className="rssOptionButton" type="button" onClick={() => allow(feed.url)}>
                  {uiText('allow_3ad0e3')}
                </button>
              ) : null}
              <button
                className="rssOptionIcon"
                type="button"
                aria-label={`Remove ${feed.title || feed.url}`}
                onClick={() => remove(feed.url)}
              >
                <MdDeleteOutline />
              </button>
            </Action>
          </Row>
        ))}

        <Row>
          <Content
            title={uiText('add_a_feed_f00cf4')}
            subtitle={uiText('any_rss_or_atom_address_adding_it_asks_the_br_d4723c')}
          />
        </Row>

        {/* The address is the longest thing typed in these settings, so it takes the row
            rather than the action column, with the add itself as the glyph at its end. */}
        <Row>
          <div className="rssFeedField">
            <input
              className="text-field-input rssOptionInput"
              type="url"
              value={draft}
              placeholder={uiText('example_com_feed_xml_098287')}
              aria-label={uiText('feed_address_3d4c56')}
              onChange={(event) => {
                setDraft(event.target.value);
                setError('');
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add();
              }}
            />
            <button
              className="rssOptionGlyph"
              type="button"
              onClick={add}
              aria-label={uiText('add_feed_6aa1f2')}
              title={uiText('add_feed_6aa1f2')}
            >
              <MdAdd />
            </button>
          </div>
        </Row>

        {error ? (
          <Row>
            <Content subtitle={error} />
          </Row>
        ) : null}
      </Group>

      <Group>
        <Section
          title={uiText('feedly_68002a')}
          subtitle={uiText('a_personal_access_token_from_feedly_com_v3_au_766f03')}
        />

        <Row>
          <div className="rssFeedField">
            <Text
              name="feedlyToken"
              title={uiText('access_token_f69d5c')}
              placeholder={uiText('the_token_feedly_shows_after_you_authorise_c11506')}
              default=""
              category="feedly"
              onChange={(value) => setHasToken(Boolean(String(value).trim()))}
            />
          </div>
        </Row>

        <Row>
          <div className="rssFeedField">
            <Text
              name="feedlyRefreshToken"
              title={uiText('refresh_token_63c0a5')}
              placeholder={uiText('optional_feedly_shows_one_beside_the_token_2fb7bb')}
              default=""
              category="feedly"
            />
          </div>
        </Row>

        <Row>
          <Content
            title={uiText('connection_6512ee')}
            subtitle={
              feedly.status || uiText('feedly_answers_with_the_account_the_token_bel_e793c8')
            }
          />
          <Action>
            {/* The action column is a column: a labelled check beside its own glyph needs a row. */}
            <div className="rssActionRow">
              <Button
                type="settings"
                icon={<MdCheck />}
                label={feedly.busy ? uiText('checking_820d60') : uiText('check_token_e74cda')}
                disabled={feedly.busy || !hasToken}
                onClick={checkFeedly}
              />
              {hasToken ? (
                <button
                  className="rssOptionIcon"
                  type="button"
                  aria-label={uiText('forget_03d5d8')}
                  title={uiText('forget_03d5d8')}
                  onClick={disconnectFeedly}
                >
                  <MdDeleteOutline />
                </button>
              ) : null}
            </div>
          </Action>
        </Row>

        <Row>
          <Content title={uiText('calls_today_848b7f')} subtitle={calls} />
        </Row>
      </Group>

      <Group>
        <Section
          title={uiText('opml_ad3e0f')}
          subtitle={uiText('the_subscription_file_every_feed_reader_can_e_a50a40')}
        />

        <Row>
          <Content
            title={uiText('import_d6fbc9')}
            subtitle={uiText('a_feed_already_in_the_list_is_skipped_and_a_n_8ca89c')}
          />
          <Action>
            <Button
              type="settings"
              icon={<MdUpload />}
              label={transfer.reading ? 'Reading…' : uiText('choose_file_eb7eb7')}
              disabled={transfer.reading}
              onClick={() => document.getElementById(OPML_INPUT)?.click()}
            />
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('export_f3e4fa')}
            subtitle={`Writes ${
              feeds.length === 1 ? '1 feed' : `${feeds.length} feeds`
            }, with the folders they were imported under, as OPML.`}
          />
          <Action>
            <Button
              type="settings"
              icon={<MdDownload />}
              label={uiText('save_file_bedc84')}
              disabled={!feeds.length}
              onClick={exportOpml}
            />
          </Action>
        </Row>

        {transfer.status ? (
          <Row>
            <Content subtitle={transfer.status} />
          </Row>
        ) : null}

        <FileUpload
          id={OPML_INPUT}
          type="settings"
          accept=".opml,.xml,text/xml,application/xml,text/x-opml"
          loadFunction={async (text) => {
            setTransfer({ reading: true, status: '' });
            await importOpml(text);
          }}
        />
      </Group>

      <Group>
        <Section
          title={uiText('reading_cffa2a')}
          subtitle={uiText('choose_how_many_stories_to_show_and_when_to_c_3ab1a2')}
        />

        <Row>
          <Content
            title={uiText('headlines_shown_a65e5c')}
            subtitle={uiText('the_number_of_stories_shown_on_your_page_8534f1')}
          />
          <Action>
            <Dropdown
              name="rssItemCount"
              category="rss"
              items={COUNTS.map((value) => ({ value, text: value }))}
            />
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('check_for_new_stories_every_04beb9')}
            subtitle={uiText('in_minutes_952e8d')}
          />
          <Action>
            <Dropdown
              name="rssRefreshMinutes"
              category="rss"
              items={REFRESH.map((value) => ({ value, text: `${value} min` }))}
            />
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('full_articles_7f2177')}
            subtitle={uiText('load_articles_in_advance_so_you_can_read_them_cb2d13')}
          />
          <Action>
            <Checkbox name="rssFullArticle" category="rss" text="Full Articles on Hover" />
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('keep_full_articles_for_c11890')}
            subtitle={uiText('save_articles_for_this_long_before_loading_th_c0a27c')}
          />
          <Action>
            <Dropdown name="rssArticleTtl" category="rss" items={KEEP} />
          </Action>
        </Row>

        <WidgetSurface setting="surfaceRss" category="rss" title={uiText('rss_panel_07f858')} />
      </Group>
    </>
  );
};

export { RssOptions };

export default RssOptions;

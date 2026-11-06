import { useState, useSyncExternalStore } from 'react';
import { GoGitPullRequest, GoIssueOpened, GoCodeReview, GoPlay } from 'react-icons/go';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { WidgetShell, EmptyState } from '../widgetKit/WidgetKit';
import useRemoteWidget from '../widgetKit/useRemoteWidget';
import {
  GITHUB_SETTINGS,
  githubNewItems,
  githubNotificationsSnapshot,
  githubSettings,
  loadGitHub,
  markGitHubViewSeen,
  subscribeGitHubNotifications,
} from './githubStore';
import GitHubRow from './GitHubRow';
import GitHubDetails from './GitHubDetails';
import useGitHubPreview from './useGitHubPreview';
import './github.scss';

const VIEW_ICONS = {
  reviews: GoCodeReview,
  pulls: GoGitPullRequest,
  issues: GoIssueOpened,
  actions: GoPlay,
};
const knownErrors = ['auth', 'rate', 'offline', 'setup', 'permission', 'not-found', 'query'];
export default function GitHub() {
  const { language } = useTranslationVersion();
  const settings = githubSettings();
  const state = useRemoteWidget('github', GITHUB_SETTINGS, loadGitHub, settings.refresh);
  const [selected, setSelected] = useState(() => localStorage.getItem('githubLastView'));
  const notificationSnapshot = useSyncExternalStore(
    subscribeGitHubNotifications,
    githubNotificationsSnapshot,
    () => '{}',
  );
  const newItems = githubNewItems(notificationSnapshot);
  const notified = settings.views.find((view) => newItems[view]?.length);
  const active =
    (settings.views.includes(notified) && notified) ||
    (settings.views.includes(selected) && selected) ||
    settings.views[0];
  const view = state.data?.views[active];
  const preview = useGitHubPreview(`${state.data?.identity || ''}:${active}`);
  const detailItem =
    preview.active &&
    preview.active.anchor.isConnected &&
    view?.items.find(
      (item) => item.id === preview.active.id && item.repository === preview.active.repository,
    );
  const failure = state.data?.failures?.[active];
  const errorText = state.error
    ? uiText(
        `github_error_${knownErrors.includes(state.error.message) ? state.error.message : 'network'}`,
      )
    : null;
  const locale = language.replaceAll('_', '-');
  return (
    <>
      <WidgetShell
        widget="github"
        title="GitHub"
        titleHref="https://github.com/"
        loading={state.loading}
        onRefresh={state.refresh}
        error={errorText}
        showSettings={false}
        className="githubWidget"
      >
        {!state.data ? (
          state.loading ? (
            <p className="wkNotice">{uiText('widget_loading')}</p>
          ) : (
            <EmptyState widget="github">{uiText('github_setup')}</EmptyState>
          )
        ) : !active ? (
          <EmptyState widget="github">{uiText('github_no_views')}</EmptyState>
        ) : (
          <>
            <div
              className="wkTabList githubTabs"
              role="tablist"
              aria-label={uiText('github_views')}
              style={{ gridTemplateColumns: `repeat(${settings.views.length}, minmax(0, 1fr))` }}
            >
              {settings.views.map((key) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === active}
                  aria-controls="github-results"
                  id={`github-tab-${key}`}
                  onClick={() => {
                    localStorage.setItem('githubLastView', key);
                    markGitHubViewSeen(key);
                    setSelected(key);
                  }}
                  aria-label={`${uiText(`github_${key}`)} · ${state.data.views[key]?.total ?? '—'}${newItems[key]?.length ? ` · ${newItems[key].length} new` : ''}`}
                  title={uiText(`github_${key}`)}
                  onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const index = settings.views.indexOf(key);
                    const next =
                      event.key === 'Home'
                        ? settings.views[0]
                        : event.key === 'End'
                          ? settings.views.at(-1)
                          : settings.views[
                              (index +
                                (event.key === 'ArrowRight' ? 1 : -1) +
                                settings.views.length) %
                                settings.views.length
                            ];
                    setSelected(next);
                    document.getElementById(`github-tab-${next}`)?.focus();
                  }}
                  tabIndex={key === active ? 0 : -1}
                >
                  {(() => {
                    const Icon = VIEW_ICONS[key];
                    return <Icon aria-hidden="true" />;
                  })()}
                  <span aria-hidden="true">
                    {state.data.views[key]
                      ? new Intl.NumberFormat(locale, {
                          notation: 'compact',
                          maximumFractionDigits: 1,
                        }).format(state.data.views[key].total)
                      : '—'}
                  </span>
                  {newItems[key]?.length > 0 && (
                    <span className="githubNewCount" aria-hidden="true">
                      {newItems[key].length > 9 ? '9+' : newItems[key].length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <section role="tabpanel" id="github-results" aria-labelledby={`github-tab-${active}`}>
              {failure && (
                <p className="wkNotice" role="status">
                  {uiText(`github_error_${knownErrors.includes(failure) ? failure : 'network'}`)}{' '}
                  {view && uiText('widget_cached_error')}
                </p>
              )}
              {view?.incomplete && <p className="wkNotice">{uiText('github_partial')}</p>}
              {active === 'actions' && view?.needsRepos ? (
                <EmptyState widget="github">{uiText('github_actions_setup')}</EmptyState>
              ) : view && !view.items.length && !failure ? (
                <p className="wkNotice">{uiText(`github_empty_${active}`)}</p>
              ) : (
                <ul className="gwList githubList">
                  {view?.items.map((item) => (
                    <GitHubRow
                      key={`${item.repository}/${item.id}`}
                      item={item}
                      view={active}
                      locale={locale}
                      preview={preview}
                      showUpdated={localStorage.getItem('githubShowUpdated') !== 'false'}
                    />
                  ))}
                </ul>
              )}
            </section>
            {state.error?.retryAt && (
              <p className="wkUpdated">
                {uiText('github_retry_at', {
                  time: new Date(state.error.retryAt).toLocaleTimeString(locale, {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                })}
              </p>
            )}
            <footer className="githubFooter">
              <span title={!state.data.authenticated ? uiText('github_public_mode') : undefined}>
                {view && uiText('widget_showing', { shown: view.items.length, total: view.total })}
              </span>
              {state.data.updated && (
                <time
                  dateTime={new Date(state.data.updated).toISOString()}
                  title={uiText('widget_updated', {
                    time: new Date(state.data.updated).toLocaleString(locale),
                  })}
                >
                  {new Date(state.data.updated).toLocaleString(locale, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </time>
              )}
            </footer>
          </>
        )}
      </WidgetShell>
      {detailItem && (
        <GitHubDetails item={detailItem} view={active} locale={locale} preview={preview} />
      )}
    </>
  );
}

import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { MdOpenInNew } from 'react-icons/md';

import { Row, Content, Action, Group } from 'components/Layout/Settings/Item';
import { Text } from 'components/Form/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';

import { useGoogleAuth } from '../hooks/useGoogleAuth';
import { getRedirectUri, SCOPES } from '../auth';
import { ensureDefaults } from '../settings';
import GoogleWidgetSettings from './WidgetSettings';
import DriveOptions from '../drive/DriveOptions';
import { describeError } from '../components/ConnectPrompt';

import '../google.scss';

const SERVICE_LABELS = {
  'https://www.googleapis.com/auth/gmail.readonly': 'Mail, read only',
  'https://www.googleapis.com/auth/calendar.events': 'Calendar events, read and write',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly':
    'Calendar list, to pick which calendars show',
  'https://www.googleapis.com/auth/tasks': 'Tasks, read and write',
  'https://www.googleapis.com/auth/drive.metadata.readonly': 'Drive file metadata, read only',
};

const CREDENTIALS_URL = 'https://console.cloud.google.com/apis/credentials';

/**
 * Google needs an app of your own first, so the order mirrors the work: register, paste
 * credentials, connect. Connect stays locked until both credentials are in, or it can only fail.
 */
const Step = ({ number }) => <span className="googleStepNumber">{number}</span>;

const GoogleOptions = () => {
  useTranslationVersion();
  const { auth, loading, error, connectAccount, disconnectAccount } = useGoogleAuth();
  const [busy, setBusy] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  useEffect(() => {
    try {
      setRedirectUri(getRedirectUri());
    } catch {
      setRedirectUri('');
    }

    setClientId(localStorage.getItem('googleClientId') || '');
    setClientSecret(localStorage.getItem('googleClientSecret') || '');
    ensureDefaults();
  }, []);

  const ready = Boolean(clientId.trim() && clientSecret.trim());

  const connectNow = useCallback(async () => {
    setBusy(true);

    try {
      const next = await connectAccount();
      toast(`Google connected${next?.email ? ` as ${next.email}` : ''}`);

      // The widgets only wake up when they are told something changed.
      window.location.reload();
    } catch {
      // Reported through `error` below.
    } finally {
      setBusy(false);
    }
  }, [connectAccount]);

  const disconnectNow = useCallback(async () => {
    setBusy(true);

    try {
      await disconnectAccount();
      toast('Google disconnected');
      window.location.reload();
    } finally {
      setBusy(false);
    }
  }, [disconnectAccount]);

  return (
    <>
      {/* Registering the app is one procedure in three steps, so the steps are
          one block: the redirect URI and the scopes belong to step 1, and the
          Connect button only makes sense after step 2. */}
      <Group>
        <Row>
          <Content
            title={
              <>
                <Step number="1" />
                {uiText('register_moo_in_google_cloud_a4d4d0')}
              </>
            }
            subtitle={
              redirectUri.includes('.chromiumapp.org')
                ? 'In your own Google Cloud project, enable the Gmail, Calendar, Tasks and Drive APIs. Create an OAuth client of type Web application and add the redirect URI below to its Authorized redirect URIs.'
                : uiText('google_only_answers_apps_it_knows_about_and_m_283a79')
            }
          />
          <Action>
            <a
              className="gwButton googleOpenLink"
              href={CREDENTIALS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {uiText('open_google_cloud_e03ae9')}
              <MdOpenInNew />
            </a>
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('paste_this_redirect_uri_when_google_asks_5e50cd')}
            subtitle={uiText('copy_it_exactly_as_it_is_it_belongs_to_this_i_ac6486')}
          />
          <Action>
            <code className="googleRedirect">
              {redirectUri || 'only visible inside the extension'}
            </code>
          </Action>
        </Row>

        <Row>
          <Content
            title={uiText('scopes_moo_will_ask_for_418c5c')}
            subtitle={uiText('the_permissions_the_app_requests_nothing_is_r_c5eb60')}
          />
          <Action>
            <ul className="googleScopeList">
              {SCOPES.filter((scope) => SERVICE_LABELS[scope]).map((scope) => (
                <li key={scope}>{SERVICE_LABELS[scope]}</li>
              ))}
            </ul>
          </Action>
        </Row>

        <Row>
          <Content
            title={
              <>
                <Step number="2" />
                {uiText('paste_the_client_id_and_secret_498adb')}
              </>
            }
            subtitle={uiText('both_come_from_the_app_you_made_in_step_1_moo_a79123')}
          />
          <Action>
            <Text
              name="googleClientId"
              title={uiText('client_id_a766cd')}
              placeholder={uiText('_apps_googleusercontent_com_f76874')}
              onChange={setClientId}
            />
            <Text
              name="googleClientSecret"
              title={uiText('client_secret_4b468e')}
              placeholder={uiText('gocspx_9dfa73')}
              onChange={setClientSecret}
            />
          </Action>
        </Row>

        <Row>
          <Content
            title={
              <>
                <Step number="3" />
                {uiText('connect_b65463')}
              </>
            }
            subtitle={
              loading
                ? 'Checking…'
                : auth
                  ? `Connected${auth.email ? ` as ${auth.email}` : ''}. Disconnect only forgets the tokens here; your Google account stays as it is.`
                  : ready
                    ? 'Google opens its own window and you approve the permissions there.'
                    : 'Add both values in step 2 before connecting.'
            }
          />
          <Action>
            <button
              type="button"
              className="gwButton"
              onClick={auth ? disconnectNow : connectNow}
              disabled={busy || loading || (!auth && !ready)}
            >
              {auth
                ? uiText('disconnect_google')
                : busy
                  ? uiText('waiting_for_google')
                  : uiText('connect_google')}
            </button>
          </Action>
        </Row>
      </Group>

      {error && (
        <Row>
          <Content title={uiText('last_error_5e4df8')} subtitle={describeError(error)} />
        </Row>
      )}

      <DriveOptions />
      {auth && <GoogleWidgetSettings />}

      {/* One switch per card: the three can sit over very different wallpapers,
          so the panel style is stored per widget like the other sections. */}
      {auth && (
        <Group>
          <WidgetSurface
            setting="surfaceMail"
            category="google"
            title={uiText('mail_panel_a50e62')}
          />
          <WidgetSurface
            setting="surfaceCalendar"
            category="google"
            title={uiText('calendar_panel_a9c143')}
          />
          <WidgetSurface
            setting="surfaceTasks"
            category="google"
            title={uiText('tasks_panel_b2f973')}
          />
        </Group>
      )}
    </>
  );
};

export default GoogleOptions;

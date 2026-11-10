import { useState } from 'react';
import { MdSearch, MdArrowBack } from 'react-icons/md';
import { WidgetShell } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import ConnectPrompt from '../components/ConnectPrompt';
import { hasDriveScope } from './driveService';
import useDriveFiles from './useDriveFiles';
import DriveFiles from './DriveFiles';
import { DRIVE_VIEWS, readDriveView, readDrivePageSize } from './drivePreferences';
import './drive.scss';

function DriveContents({ auth }) {
  const { language } = useTranslationVersion();
  const [view, setView] = useState(readDriveView);
  const [path, setPath] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const query = JSON.stringify({ view, folder: path.at(-1)?.id || '', search });
  const state = useDriveFiles(auth, query);
  return (
    <WidgetShell
      widget="drive"
      showSettings={false}
      title={uiText('drive_title')}
      titleHref="https://drive.google.com/drive/u/0/home"
      loading={state.loading}
      error={state.error}
      onRefresh={state.refresh}
      className="driveWidget"
    >
      <div className="driveTabs" role="group" aria-label={uiText('drive_view')}>
        {DRIVE_VIEWS.map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={view === id && path.length === 0}
            onClick={() => {
              setView(id);
              localStorage.setItem('googleDriveView', id);
              setPath([]);
            }}
          >
            {uiText(`drive_${id}`)}
          </button>
        ))}
      </div>
      <form
        className="driveSearch"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(draft.trim());
        }}
      >
        <input
          aria-label={uiText('drive_search')}
          placeholder={uiText('drive_search')}
          maxLength={200}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (!e.target.value) setSearch('');
          }}
        />
        <button type="submit" className="gwIconButton" aria-label={uiText('drive_search')}>
          <MdSearch />
        </button>
      </form>
      {path.length > 0 && (
        <button
          className="driveBack"
          type="button"
          onClick={() => setPath((old) => old.slice(0, -1))}
        >
          <MdArrowBack aria-hidden="true" />
          {uiText('drive_back')} · {path.at(-1).name}
        </button>
      )}
      <DriveFiles
        state={state}
        pageSize={readDrivePageSize()}
        language={language}
        query={query}
        onFolder={(file) => {
          setPath((old) => [...old, { id: file.id, name: file.name }]);
          setSearch('');
          setDraft('');
        }}
      />
    </WidgetShell>
  );
}

export default function GoogleDrive() {
  useTranslationVersion();
  const { auth, loading, error, connectAccount } = useGoogleAuth();
  if (loading) return null;
  if (!auth || !hasDriveScope(auth))
    return (
      <div className="driveWidget">
        <ConnectPrompt label={uiText('drive_title')} onConnect={connectAccount} error={error} />
        {auth && <p className="wkNotice">{uiText('drive_reconnect')}</p>}
      </div>
    );
  return <DriveContents key={auth.connectedAt || auth.email} auth={auth} />;
}

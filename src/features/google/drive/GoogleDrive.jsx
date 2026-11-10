import { useState } from 'react';
import { MdFolder, MdDescription, MdSearch, MdArrowBack, MdStar } from 'react-icons/md';
import { WidgetShell } from 'features/widgetKit/WidgetKit';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { useGoogleAuth } from '../hooks/useGoogleAuth';
import ConnectPrompt from '../components/ConnectPrompt';
import { DRIVE_FOLDER, driveHref, hasDriveScope } from './driveService';
import useDriveFiles from './useDriveFiles';
import './drive.scss';

function DriveContents({ auth }) {
  const { language } = useTranslationVersion();
  const [view, setView] = useState('recent');
  const [path, setPath] = useState([]);
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const query = JSON.stringify({ view, folder: path.at(-1)?.id || '', search });
  const state = useDriveFiles(auth, query);
  const fileDate = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString(language.replaceAll('_', '-'), { day: 'numeric', month: 'short' })
      : '';
  };
  return (
    <WidgetShell
      widget="drive"
      title={uiText('drive_title')}
      titleHref="https://drive.google.com/drive/u/0/home"
      loading={state.loading}
      error={state.error}
      onRefresh={state.refresh}
      className="driveWidget"
    >
      <div className="driveTabs" role="group" aria-label={uiText('drive_view')}>
        {['recent', 'starred', 'shared'].map((id) => (
          <button
            type="button"
            key={id}
            aria-pressed={view === id && path.length === 0}
            onClick={() => {
              setView(id);
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
      <div className="driveFiles" aria-live="polite">
        {state.files.map((file) => (
          <div className="driveEntry" key={file.id}>
            {file.mimeType === DRIVE_FOLDER ? (
              <button
                className="driveFile"
                type="button"
                onClick={() => {
                  setPath((old) => [...old, { id: file.id, name: file.name }]);
                  setSearch('');
                  setDraft('');
                }}
              >
                <MdFolder aria-hidden="true" />
                <span>{file.name}</span>
              </button>
            ) : (
              <a
                className="driveFile"
                href={driveHref(file)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MdDescription aria-hidden="true" />
                <span>{file.name}</span>
              </a>
            )}
            <div className="driveMeta">
              {file.starred && <MdStar aria-label={uiText('drive_starred')} />}
              <span>{file.owners?.[0]?.displayName}</span>
              <time dateTime={file.modifiedTime}>{fileDate(file.modifiedTime)}</time>
            </div>
          </div>
        ))}
        {!state.loading && !state.error && state.files.length === 0 && (
          <p className="wkEmpty">{uiText('drive_empty')}</p>
        )}
        {state.loading && <p className="wkNotice">{uiText('drive_loading')}</p>}
        {state.incomplete && <p className="wkNotice">{uiText('drive_incomplete')}</p>}
      </div>
      {state.nextPageToken && (
        <button className="gwButton" type="button" disabled={state.loading} onClick={state.more}>
          {uiText('drive_more')}
        </button>
      )}
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

import { useEffect, useRef } from 'react';
import { MdFolder, MdDescription, MdStar } from 'react-icons/md';
import { uiText } from 'lib/translations';
import { DRIVE_FOLDER, driveHref } from './driveService';
import useFadingScrollbar from './useFadingScrollbar';
import { atDriveBottom } from './drivePreferences';

export default function DriveFiles({ state, pageSize, language, onFolder, query }) {
  const { files, more, loading, error, incomplete, nextPageToken } = state;
  const list = useRef(null);
  useFadingScrollbar(list);
  useEffect(() => {
    list.current.scrollTop = 0;
  }, [query]);
  useEffect(() => {
    if (files.length < pageSize) more();
  }, [files.length, pageSize, more]);
  const loadAtBottom = () => {
    if (atDriveBottom(list.current)) more();
  };
  const fileDate = (value) => {
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString(language.replaceAll('_', '-'), { day: 'numeric', month: 'short' })
      : '';
  };
  return (
    <>
      <div
        ref={list}
        className="driveFiles"
        style={{ '--drive-visible-rows': Math.min(pageSize, files.length) }}
        role="region"
        aria-label={uiText('drive_files')}
        tabIndex={0}
        onScroll={loadAtBottom}
        onWheel={(event) => {
          if (event.deltaY > 0) loadAtBottom();
        }}
        onKeyDown={(event) => {
          if (['End', 'PageDown', 'ArrowDown', ' '].includes(event.key)) loadAtBottom();
        }}
      >
        {files.map((file) => (
          <div className="driveEntry" key={file.id}>
            {file.mimeType === DRIVE_FOLDER ? (
              <button className="driveFile" type="button" onClick={() => onFolder(file)}>
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
        {nextPageToken && <div className="drivePageBoundary" aria-hidden="true" />}
      </div>
      <div aria-live="polite" className="driveStatus">
        {!loading && !error && files.length === 0 && (
          <p className="wkEmpty">{uiText('drive_empty')}</p>
        )}
        {loading && <p className="wkNotice">{uiText('drive_loading')}</p>}
        {incomplete && <p className="wkNotice">{uiText('drive_incomplete')}</p>}
      </div>
    </>
  );
}

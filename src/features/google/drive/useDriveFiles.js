import { useEffect, useRef, useState } from 'react';
import EventBus from 'utils/eventbus';
import { listDriveFiles } from './driveService';

export default function useDriveFiles(auth, query) {
  const [result, setResult] = useState({ files: [], loading: true, error: '', nextPageToken: '' });
  const [revision, refresh] = useState(0);
  const [page, setPage] = useState({ token: '' });
  const stamp = JSON.stringify([auth, query, revision]);
  const identity = useRef('');
  const refreshMinutes = Math.max(5, Number(localStorage.getItem('googleDriveRefresh')) || 15);
  useEffect(() => {
    const sync = (category) => {
      if (!category || ['google', 'drive', 'other'].includes(category)) refresh((n) => n + 1);
    };
    const storage = (event) => {
      if (!event.key || /^(google|offlineMode|profileRevision)/.test(event.key)) sync();
    };
    const visible = () => {
      if (!document.hidden) sync();
    };
    const timer = setInterval(visible, refreshMinutes * 60000);
    EventBus.on('refresh', sync);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearInterval(timer);
      EventBus.off('refresh', sync);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [refreshMinutes]);
  useEffect(() => {
    const controller = new AbortController();
    const reset = identity.current !== stamp;
    identity.current = stamp;
    const token = reset ? '' : page.token;
    setResult((old) => ({
      ...old,
      ...(reset ? { files: [], nextPageToken: '' } : {}),
      loading: true,
      error: '',
    }));
    if (!auth) {
      setResult({ files: [], loading: false, error: '', nextPageToken: '' });
      return () => controller.abort();
    }
    listDriveFiles(
      { ...JSON.parse(query), pageToken: token, limit: localStorage.getItem('googleDriveMax') },
      controller.signal,
    )
      .then((data) => {
        if (controller.signal.aborted) return;
        setResult((old) => ({
          ...data,
          files: token
            ? [...new Map([...old.files, ...data.files].map((file) => [file.id, file])).values()]
            : data.files,
          loading: false,
          error: '',
        }));
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setResult((old) => ({ ...old, loading: false, error: error.message }));
      });
    return () => controller.abort();
  }, [auth, stamp, query, page]);
  return {
    ...result,
    refresh: () => refresh((n) => n + 1),
    more: () => setPage({ token: result.nextPageToken }),
  };
}

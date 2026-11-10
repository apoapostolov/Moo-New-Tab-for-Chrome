import { useEffect, useRef, useState, useCallback } from 'react';
import EventBus from 'utils/eventbus';
import { settingsStamp } from 'utils/requests';

const isConfigKey = (match, key) => match.test(key) && !/(?:Cache|Retry)$/.test(key);
const configStamp = (match) => settingsStamp({ test: (key) => isConfigKey(match, key) });

export default function useRemoteWidget(
  category,
  match,
  loader,
  refreshMinutes,
  { preservePending = false } = {},
) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const owner = useRef(null);
  const pending = useRef(false);
  const identity = useRef('');
  const load = useCallback(
    async (force = false) => {
      owner.current?.abort();
      const controller = new AbortController();
      owner.current = controller;
      pending.current = true;
      const stamp = configStamp(match);
      const same = identity.current === stamp;
      identity.current = stamp;
      setState((previous) => ({ data: same ? previous.data : null, error: null, loading: true }));
      try {
        const result = await loader(force, controller.signal);
        if (controller.signal.aborted || stamp !== configStamp(match)) return;
        setState({ data: result.data, error: result.error || null, loading: false });
      } catch (error) {
        if (!controller.signal.aborted && stamp === configStamp(match))
          setState((previous) => ({
            ...previous,
            ...(error.message === 'auth' ? { data: null } : {}),
            error,
            loading: false,
          }));
      } finally {
        if (owner.current === controller) pending.current = false;
      }
    },
    [match, loader],
  );
  useEffect(() => {
    const first = setTimeout(() => load(), 0);
    const tick = setInterval(() => {
      if (!document.hidden && (!preservePending || !pending.current)) load();
    }, refreshMinutes * 60000);
    const refresh = (key) => {
      if ([category, 'other'].includes(key)) load();
    };
    const storage = (event) => {
      if (event.key && isConfigKey(match, event.key)) load();
    };
    const visible = () => {
      if (!document.hidden && (!preservePending || !pending.current)) load();
    };
    EventBus.on('refresh', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
      owner.current?.abort();
      EventBus.off('refresh', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [category, match, load, refreshMinutes, preservePending]);
  return { ...state, refresh: () => load(true), reload: load };
}

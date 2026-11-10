import { useEffect, useRef, useState } from 'react';
import EventBus from 'utils/eventbus';
import { uiText } from 'lib/translations';
import { localDay } from './subscriptionDates';
import { readSubscriptions, updateSubscriptions } from './subscriptionStore';

export default function useSubscriptions() {
  const [state, setState] = useState(readSubscriptions);
  const [today, setToday] = useState(localDay);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  useEffect(() => {
    const sync = () => {
      setState(readSubscriptions());
      setToday(localDay());
    };
    const refresh = (category) => {
      if (['subscriptions', 'other'].includes(category)) sync();
    };
    const storage = (event) => {
      if (!event.key || event.key.startsWith('subscriptions') || event.key === 'profileRevision')
        sync();
    };
    const visible = () => {
      if (!document.hidden) sync();
    };
    EventBus.on('subscriptions', sync);
    EventBus.on('refresh', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 30000);
    return () => {
      EventBus.off('subscriptions', sync);
      EventBus.off('refresh', refresh);
      window.removeEventListener('storage', storage);
      document.removeEventListener('visibilitychange', visible);
      clearInterval(timer);
    };
  }, []);
  const change = async (action) => {
    if (saving.current) return false;
    saving.current = true;
    setPending(true);
    try {
      await updateSubscriptions(action);
      setError('');
      return true;
    } catch (failure) {
      const code = ['changed', 'damaged', 'limit'].includes(failure.message)
        ? failure.message
        : 'save';
      setError(uiText(`subscriptions_error_${code}`));
      return false;
    } finally {
      saving.current = false;
      setPending(false);
    }
  };
  return { ...state, today, pending, error, change };
}

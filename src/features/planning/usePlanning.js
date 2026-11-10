import { useEffect, useRef, useState } from 'react';
import EventBus from 'utils/eventbus';
import { uiText } from 'lib/translations';
import { planningDay } from './planningDates';
import { readPlanning, updatePlanning } from './planningStore';

export default function usePlanning() {
  const [state, setState] = useState(readPlanning);
  const [today, setToday] = useState(planningDay);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const saving = useRef(false);
  useEffect(() => {
    const sync = () => {
      setState(readPlanning());
      setToday(planningDay());
    };
    const refresh = (category) => {
      if (['planning', 'other'].includes(category)) sync();
    };
    const storage = (event) => {
      if (!event.key || event.key.startsWith('planning') || event.key === 'profileRevision') sync();
    };
    const visible = () => {
      if (!document.hidden) sync();
    };
    EventBus.on('planning', sync);
    EventBus.on('refresh', refresh);
    window.addEventListener('storage', storage);
    document.addEventListener('visibilitychange', visible);
    const timer = setInterval(visible, 30000);
    return () => {
      EventBus.off('planning', sync);
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
      await updatePlanning(action);
      setError('');
      return true;
    } catch (failure) {
      const code = ['changed', 'damaged', 'limit', 'priority'].includes(failure.message)
        ? failure.message
        : 'save';
      setError(uiText(`planning_error_${code}`));
      return false;
    } finally {
      saving.current = false;
      setPending(false);
    }
  };
  return { ...state, today, pending, error, change };
}

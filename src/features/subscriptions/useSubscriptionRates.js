import { useEffect, useState } from 'react';
import {
  displayCurrency,
  loadSubscriptionRates,
  subscriptionRateResult,
} from './subscriptionRates';

export default function useSubscriptionRates(items, today) {
  const base = displayCurrency();
  const currencies = JSON.stringify([...new Set(items.map((item) => item.currency))].sort());
  const key = `${base}:${currencies}`;
  const [state, setState] = useState(() => ({
    ...subscriptionRateResult(null, base, JSON.parse(currencies)),
    loading: true,
    key,
  }));
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const visible = () => {
      if (!document.hidden) setTick((old) => old + 1);
    };
    window.addEventListener('online', visible);
    document.addEventListener('visibilitychange', visible);
    const interval = setInterval(visible, 60000);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online', visible);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    loadSubscriptionRates(base, JSON.parse(currencies), controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setState({ ...result, loading: false, key });
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setState({
            ...subscriptionRateResult(null, base, JSON.parse(currencies), true),
            loading: false,
            key,
          });
      });
    return () => controller.abort();
  }, [base, currencies, key, today, tick]);
  return state.key === key
    ? state
    : { ...subscriptionRateResult(state, base, JSON.parse(currencies)), loading: true };
}

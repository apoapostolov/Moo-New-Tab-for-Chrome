import { useCallback, useEffect, useRef, useState } from 'react';
import WidgetCard from 'components/Elements/WidgetCard/WidgetCard';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import EventBus from 'utils/eventbus';
import { updateHash } from 'utils/deepLinking';
import {
  holdingId,
  loadPortfolio,
  loadRates,
  portfolioTotals,
  topHoldings,
  readCurrency,
  readHoldingsState,
  readPortfolioCache,
  readRatesCache,
  REFRESH_MS,
} from './portfolioStore';
import PortfolioHeader from './PortfolioHeader';
import Curve from './PortfolioCurve';
import { readHistory, savePoint } from './portfolioHistory';
import './portfolio.scss';

const money = (amount, currency) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
const signed = (amount, currency) =>
  `${amount < 0 ? '−' : '+'}${money(Math.abs(amount), currency)}`;
const trendClass = (amount) => (amount > 0 ? 'positive' : amount < 0 ? 'negative' : '');
const openSettings = () => {
  updateHash('#settings/portfolio');
  EventBus.emit('modal', 'openMainModal');
};

export default function Portfolio() {
  useTranslationVersion();
  const [state, setState] = useState({ status: 'loading', holdings: [], data: null });
  const generation = useRef(0);
  const load = useCallback(async (force = false) => {
    const revision = ++generation.current;
    const { holdings, damaged } = readHoldingsState();
    const provider = localStorage.getItem('portfolioProvider') || 'finnhub';
    const currency = readCurrency();
    if (damaged) {
      setState({ status: 'damaged', holdings, data: null });
      return;
    }
    if (!holdings.length) {
      setState({ status: 'empty', holdings, data: null });
      return;
    }
    const cached = readPortfolioCache(holdings, provider);
    setState({
      status: cached ? 'refreshing' : 'loading',
      holdings,
      data: cached,
      exchange: readRatesCache(),
      currency,
    });
    try {
      const data = await loadPortfolio(holdings, provider, force);
      if (generation.current !== revision || !data) return;
      const needsRates = Object.values(data.quotes).some((quote) => quote.currency !== currency);
      const exchange = needsRates ? await loadRates() : null;
      if (generation.current !== revision) return;
      const totals = portfolioTotals(holdings, data.quotes, currency, exchange?.rates);
      if (totals.complete && !data.failed?.length) {
        try {
          savePoint(`${data.stamp}:${currency}`, data.updated, totals.value);
        } catch {
          /* Quotes remain usable if history cannot be saved. */
        }
      }
      setState({
        status: data.failed?.length ? 'error' : 'ready',
        holdings,
        data,
        exchange,
        currency,
      });
    } catch (error) {
      if (generation.current !== revision) return;
      setState({
        status: error.message === 'missing-key' ? 'key' : 'error',
        holdings,
        data: cached,
        exchange: readRatesCache(),
        currency,
      });
    }
  }, []);
  useEffect(() => {
    const first = setTimeout(load, 0);
    const refresh = (category) => {
      if (category === 'portfolio') load();
    };
    const storage = (event) => {
      if (
        [
          'portfolioHoldings',
          'portfolioProvider',
          'portfolioCurrency',
          'portfolioFinnhubApiKey',
          'portfolioTwelveDataApiKey',
        ].includes(event.key)
      )
        load();
    };
    EventBus.on('refresh', refresh);
    window.addEventListener('storage', storage);
    const timer = setInterval(() => load(), REFRESH_MS);
    return () => {
      generation.current += 1;
      clearTimeout(first);
      clearInterval(timer);
      EventBus.off('refresh', refresh);
      window.removeEventListener('storage', storage);
    };
  }, [load]);
  const currency = state.currency || readCurrency();
  const totals = state.data
    ? portfolioTotals(state.holdings, state.data.quotes, currency, state.exchange?.rates)
    : null;
  const rows = topHoldings(totals?.rows || []);
  const points =
    state.data && totals?.complete ? readHistory(`${state.data.stamp}:${currency}`) : [];
  const timestamps = state.data
    ? Object.values(state.data.quotes)
        .map((quote) => quote.timestamp)
        .filter((time) => Number.isFinite(time) && time > 0)
    : [];
  return (
    <WidgetCard
      widget="portfolio"
      className="portfolioCard"
      aria-busy={state.status === 'loading' || state.status === 'refreshing'}
    >
      <PortfolioHeader
        busy={state.status === 'loading' || state.status === 'refreshing'}
        onRefresh={() => load(true)}
      />
      {state.status === 'damaged' ? (
        <div className="portfolioHint">{uiText('portfolio_data_damaged')}</div>
      ) : state.status === 'empty' || state.status === 'key' ? (
        <div className="portfolioEmpty">
          <span>
            {uiText(state.status === 'empty' ? 'portfolio_add_prompt' : 'portfolio_key_prompt')}
          </span>
          <button type="button" onClick={openSettings}>
            {uiText('portfolio_settings')}
          </button>
        </div>
      ) : state.status === 'loading' && !state.data ? (
        <div className="portfolioHint">{uiText('portfolio_loading')}</div>
      ) : totals?.complete ? (
        <>
          <div className="portfolioValue">{money(totals.value, currency)}</div>
          <div className={`portfolioChange ${trendClass(totals.day)}`}>
            {totals.day == null
              ? uiText('portfolio_day_unavailable')
              : `${signed(totals.day, currency)} · ${totals.dayPercent == null ? '—' : `${totals.dayPercent >= 0 ? '+' : '−'}${Math.abs(totals.dayPercent).toFixed(2)}%`} ${uiText('portfolio_today')}`}
          </div>
          {totals.profit != null && (
            <div className={`portfolioHint ${trendClass(totals.profit)}`}>
              {uiText('portfolio_unrealised')}: {signed(totals.profit, currency)}
            </div>
          )}
          <Curve points={points} change={totals.day} />
          {points.length >= 2 && (
            <div className="portfolioHint">{uiText('portfolio_recorded_history')}</div>
          )}
          {rows.length > 0 && (
            <div className="portfolioRows">
              <div className="portfolioHint">{uiText('portfolio_holdings')}</div>
              {rows.map((row) => (
                <div className="portfolioRow" key={holdingId(row)}>
                  <span>
                    <strong>{row.symbol}</strong>
                    {row.exchange && <small>{row.exchange}</small>}
                    <small>
                      {row.shares} {uiText('portfolio_shares')}
                    </small>
                  </span>
                  <span className={trendClass(row.day)}>
                    {row.day == null ? '—' : signed(row.day, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="portfolioHint">
          {uiText('portfolio_incomplete')}
          {state.data?.failed?.length ? ` ${state.data.failed.join(', ')}` : ''}
        </div>
      )}
      {state.data && (
        <div className="portfolioFoot">
          {uiText('portfolio_delayed')} · {new Date(state.data.updated).toLocaleString()}
        </div>
      )}
      {timestamps.length > 0 && (
        <div className="portfolioFoot">
          {uiText('portfolio_quote_time')} · {new Date(Math.min(...timestamps)).toLocaleString()}
        </div>
      )}
      {state.exchange && (
        <div className="portfolioFoot">
          {uiText('portfolio_fx_rates')} · {state.exchange.date} ·{' '}
          <a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer">
            Frankfurter
          </a>
        </div>
      )}
      {state.status === 'error' && (
        <div className="portfolioHint">
          {uiText('portfolio_error')}
          {state.data?.failed?.length ? ` ${state.data.failed.join(', ')}` : ''}
        </div>
      )}
    </WidgetCard>
  );
}

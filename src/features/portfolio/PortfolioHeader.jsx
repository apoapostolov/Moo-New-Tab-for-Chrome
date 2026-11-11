import { MdRefresh } from 'react-icons/md';
import { WidgetHeader } from 'components/Elements/WidgetCard/WidgetCard';
import { uiText } from 'lib/translations';
export default function PortfolioHeader({ busy, onRefresh }) {
  return (
    <WidgetHeader>
      <span className="portfolioLabel">{uiText('portfolio_title')}</span>
      <span className="portfolioActions">
        <button
          type="button"
          disabled={busy}
          onClick={onRefresh}
          aria-label={uiText('portfolio_refresh')}
          title={uiText('portfolio_refresh')}
        >
          <MdRefresh />
        </button>
      </span>
    </WidgetHeader>
  );
}

import { useState } from 'react';
import { uiText } from 'lib/translations';
import ServiceLogo from './ServiceLogo';
import { searchServices, serviceName } from './serviceLogos';

export default function ServicePicker({ service, name, onChange }) {
  const [search, setSearch] = useState(name);
  const [limit, setLimit] = useState(12);
  const results = searchServices(search, limit);
  return (
    <details
      className="subscriptionServices"
      onToggle={(e) => {
        if (e.currentTarget.open) {
          setSearch(name);
          setLimit(12);
        }
      }}
    >
      <summary>
        {uiText('subscriptions_logo')} ·{' '}
        {service ? serviceName(service) : uiText('subscriptions_initials')}
      </summary>
      <input
        type="search"
        aria-label={uiText('subscriptions_search_logos')}
        placeholder={uiText('subscriptions_search_logos')}
        maxLength={100}
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setLimit(12);
        }}
      />
      <div className="subscriptionLogoChoices">
        <button type="button" aria-pressed={!service} onClick={() => onChange('')}>
          {uiText('subscriptions_initials')}
        </button>
        {results.map((id) => (
          <button type="button" key={id} aria-pressed={id === service} onClick={() => onChange(id)}>
            <ServiceLogo service={id} name={serviceName(id)} />
            <span>{serviceName(id)}</span>
          </button>
        ))}
      </div>
      {results.length === limit && (
        <button type="button" className="gwButton" onClick={() => setLimit((old) => old + 24)}>
          {uiText('drive_more')}
        </button>
      )}
      <p className="subscriptionHint">{uiText('subscriptions_logo_hint')}</p>
    </details>
  );
}

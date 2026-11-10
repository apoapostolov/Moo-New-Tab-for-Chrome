import { uiText } from 'lib/translations';
import { CYCLES, STATUSES } from './subscriptionSchema';
import { findService } from './serviceLogos';
import ServicePicker from './ServicePicker';

export default function SubscriptionFields({ draft, set, when, setWhen, date, invalid }) {
  return (
    <>
      <label>
        {uiText('subscriptions_name')}
        <input
          name="subscriptionName"
          required
          maxLength={120}
          value={draft.name}
          onChange={(e) => {
            set('name', e.target.value);
            if (!draft.service) set('service', findService(e.target.value));
          }}
        />
      </label>
      <ServicePicker
        service={draft.service}
        name={draft.name}
        onChange={(value) => set('service', value)}
      />
      <div className="subscriptionFormPair">
        <label>
          {uiText('subscriptions_amount')}
          <input
            name="subscriptionAmount"
            required
            inputMode="decimal"
            value={draft.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </label>
        <label>
          {uiText('subscriptions_currency')}
          <input
            name="subscriptionCurrency"
            required
            minLength={3}
            maxLength={3}
            value={draft.currency}
            onChange={(e) => set('currency', e.target.value.toUpperCase())}
            list="subscriptionCurrencies"
          />
          <datalist id="subscriptionCurrencies">
            {['EUR', 'USD', 'GBP', 'BGN', 'CHF', 'CAD', 'AUD', 'JPY', 'INR', 'RON'].map((code) => (
              <option key={code} value={code} />
            ))}
          </datalist>
        </label>
      </div>
      <div className="subscriptionFormPair">
        <label>
          {uiText('subscriptions_cycle')}
          <select
            name="subscriptionCycle"
            value={draft.cycle}
            onChange={(e) => set('cycle', e.target.value)}
          >
            {CYCLES.map((id) => (
              <option key={id} value={id}>
                {uiText(`subscriptions_${id}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {uiText('subscriptions_status')}
          <select
            name="subscriptionStatus"
            value={draft.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {STATUSES.map((id) => (
              <option key={id} value={id}>
                {uiText(`subscriptions_${id}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        {uiText(draft.status === 'trial' ? 'subscriptions_trial_end' : 'subscriptions_next_date')}
        <input
          name="subscriptionDate"
          required
          value={when}
          maxLength={100}
          placeholder="tomorrow, in 30 days, 2027-01-31"
          aria-invalid={(invalid && !date) || undefined}
          onChange={(e) => setWhen(e.target.value)}
        />
      </label>
      {date && when !== date && (
        <p className="subscriptionHint" aria-live="polite">
          {date}
        </p>
      )}
      <label>
        {uiText('subscriptions_notice')}
        <input
          name="subscriptionNotice"
          type="number"
          required
          min="0"
          max="365"
          step="1"
          value={draft.noticeDays}
          onChange={(e) => set('noticeDays', e.target.value)}
        />
      </label>
      <label>
        {uiText('subscriptions_url')}
        <input
          name="subscriptionUrl"
          type="url"
          maxLength={2000}
          value={draft.url}
          onChange={(e) => set('url', e.target.value)}
        />
      </label>
      <label>
        {uiText('subscriptions_notes')}
        <textarea
          name="subscriptionNotes"
          rows={3}
          maxLength={2000}
          value={draft.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </label>
    </>
  );
}

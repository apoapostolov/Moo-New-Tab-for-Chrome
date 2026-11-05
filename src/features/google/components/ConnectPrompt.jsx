import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { useState } from 'react';

/**
 * Every widget starts here when no account is linked; connecting is the same flow the settings
 * section offers.
 */

const ConnectPrompt = ({ label, onConnect, error }) => {
  useTranslationVersion();
  const [busy, setBusy] = useState(false);

  const connectNow = async () => {
    setBusy(true);

    try {
      await onConnect();
    } catch {
      // The hook surfaces the error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="googleWidget googleWidgetEmpty" role="region" aria-label={label}>
      <span className="gwLabel">{label}</span>
      <button type="button" className="gwButton primary" onClick={connectNow} disabled={busy}>
        {busy ? uiText('waiting_for_google') : uiText('connect_google')}
      </button>
      {error && <p className="gwError">{describeError(error)}</p>}
    </div>
  );
};

export const describeError = (error) => {
  switch (error) {
    case 'MISSING_CREDENTIALS':
      return uiText('google_missing_credentials');
    case 'NOT_CONNECTED':
      return uiText('google_not_connected');
    case 'NO_CODE':
      return uiText('google_no_code');
    case 'STATE_MISMATCH':
      return uiText('google_state_mismatch');
    case 'AUTH_FLOW_IN_PROGRESS':
      return 'A Google sign-in window is already open. Finish or close it before trying again.';
    default:
      return error;
  }
};

export default ConnectPrompt;

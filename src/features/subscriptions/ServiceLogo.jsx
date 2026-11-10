import { useState } from 'react';
import { serviceLogo } from './serviceLogos';

export default function ServiceLogo({ service, name }) {
  const remote =
    localStorage.getItem('offlineMode') !== 'true' &&
    localStorage.getItem('subscriptionsRemoteIcons') !== 'false';
  const src = serviceLogo(service, remote);
  const [failed, setFailed] = useState('');
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => [...word][0])
    .join('')
    .toUpperCase();
  return (
    <span className="subscriptionLogo" aria-hidden="true">
      {src && src !== failed ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <span>{initials || '◇'}</span>
      )}
    </span>
  );
}

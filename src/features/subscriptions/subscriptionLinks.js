import { safeManageUrl } from './subscriptionSchema';

export const readSubscriptionLinkTarget = () =>
  localStorage.getItem('subscriptionsLinkTarget') === '_self' ? '_self' : '_blank';
export function subscriptionLinkProps(value) {
  const href = safeManageUrl(value);
  if (!href) return null;
  const target = readSubscriptionLinkTarget();
  return { href, target, rel: target === '_blank' ? 'noopener noreferrer' : undefined };
}

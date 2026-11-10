import catalogue from './serviceCatalog.json';
import bundled from './bundledServices.json';

const entries = new Map(
  catalogue.icons.map(([id, aliases, format]) => [id, { id, aliases, format }]),
);
const local = new Set(bundled);
const normalize = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
export const serviceName = (id) =>
  id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
export function findService(name) {
  const needle = normalize(name);
  return needle ? catalogue.icons.find(([id]) => normalize(id) === needle)?.[0] || '' : '';
}
export function searchServices(value, limit = 12) {
  const needle = normalize(value);
  const source = needle ? catalogue.icons : bundled.map((id) => [id, '']);
  return source
    .filter(([id, aliases]) => !needle || normalize(`${id} ${aliases}`).includes(needle))
    .slice(0, limit)
    .map(([id]) => id);
}
export function serviceLogo(id, remote = true) {
  const entry = entries.get(id);
  if (!entry) return '';
  if (local.has(id)) return `${import.meta.env.BASE_URL}src/assets/subscription-icons/${id}.${entry.format}`;
  return remote
    ? `https://raw.githubusercontent.com/homarr-labs/dashboard-icons/${catalogue.commit}/${entry.format}/${id}.${entry.format}`
    : '';
}

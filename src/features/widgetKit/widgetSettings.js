import EventBus from 'utils/eventbus';
import { updateHash } from 'utils/deepLinking';

const SECTIONS = {
  date: 'time',
  quickweather: 'weather',
  aiask: 'order',
  photoinfo: 'background',
  countdown: 'floats',
  mail: 'google',
  calendar: 'google',
  tasks: 'google',
  drive: 'google',
};
export function widgetSettingsPath(widget) {
  return `#settings/${SECTIONS[widget] || widget}`;
}
export function openWidgetSettings(widget) {
  updateHash(widgetSettingsPath(widget));
  EventBus.emit('modal', 'openMainModal');
}

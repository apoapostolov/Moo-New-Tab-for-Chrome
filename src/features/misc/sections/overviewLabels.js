import { uiText } from 'lib/translations';
import { WIDGETS } from 'utils/widgets';
const ZONE_KEYS = {
  left: 'zone_left',
  center: 'zone_center',
  right: 'zone_right',
  'top-left': 'zone_top_left',
  'top-right': 'zone_top_right',
};
export const zoneTitle = (zone) => uiText(ZONE_KEYS[zone]);

// Stands in for the card being dragged while the columns are drawn, so a column can
// open a space for it without holding on to it.
export const SLOT = '\u0000slot';

export const widgetLabel = (id) => {
  const widget = WIDGETS.find((item) => item.id === id);

  return widget ? widget.label() : id;
};

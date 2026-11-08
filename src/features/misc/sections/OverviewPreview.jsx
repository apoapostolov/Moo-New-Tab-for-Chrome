import WidgetPreview from './overview_skeletons/WidgetPreview';
import { isWidgetEnabled, isFullWidth } from 'utils/widgets';
import { widgetLabel } from './overviewLabels';
export default function OverviewPreview({ zone, groups, profile, secondLane }) {
  const previewItem = (id) => <WidgetPreview id={id} label={widgetLabel(id)} />;

  // `wide` for the lines that read across the middle column: two cards wide, as on the page.
  const previewCard = ({ id, node }, wide = false) => (
    <div className={`previewItem${wide ? ' previewItem-wide' : ''}`} key={`preview-${id}`}>
      {node}
    </div>
  );

  const previewItems = (zone) =>
    groups[zone]
      .filter((id) => isWidgetEnabled(id, profile))
      .map((id) => ({ id, node: previewItem(id) }))
      .filter(({ node }) => node !== null);

  const previewZone = () => {
    const items = previewItems(zone);

    // One column until something sits in the second.
    if (zone !== 'center' || secondLane.length === 0) {
      return (
        <div className={`previewZone previewZone-${zone}`}>
          {items.map((item) => previewCard(item, isFullWidth(item.id)))}
        </div>
      );
    }

    const inSecond = (id) => secondLane.includes(id);
    const lines = items.filter(({ id }) => isFullWidth(id));
    const first = items.filter(({ id }) => !isFullWidth(id) && !inSecond(id));
    const second = items.filter(({ id }) => !isFullWidth(id) && inSecond(id));

    return (
      <div className={`previewZone previewZone-${zone}`}>
        {lines.map((item) => previewCard(item, true))}
        <div className="previewLanes">
          <div className="previewLane">
            {first.map(({ id, node }) => previewCard({ id, node }))}
          </div>
          <div className="previewLane">
            {second.map(({ id, node }) => previewCard({ id, node }))}
          </div>
        </div>
      </div>
    );
  };

  return previewZone();
}

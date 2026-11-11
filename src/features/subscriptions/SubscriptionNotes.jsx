import useSidePreview from 'features/widgetKit/useSidePreview';
import { uiText } from 'lib/translations';

export default function SubscriptionNotes({ item, preview, id }) {
  const { panelRef } = preview;
  const style = useSidePreview(preview.active.anchor, panelRef, 340);
  return (
    <div
      ref={panelRef}
      id={id}
      popover="manual"
      role="tooltip"
      className="subscriptionNotesPreview"
      style={style}
      onMouseEnter={preview.enter}
      onMouseLeave={preview.leave}
    >
      <strong>{item.name}</strong>
      <span className="subscriptionNotesLabel">{uiText('subscriptions_notes')}</span>
      <p>{item.notes}</p>
    </div>
  );
}

import { Fragment } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { MdOutlineDragIndicator } from 'react-icons/md';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { isFullWidth } from 'utils/widgets';
import { SLOT, widgetLabel, zoneTitle } from './overviewLabels';
const Card = ({ id, enabled, onToggle, onMove }) => {
  useTranslationVersion();
  const { attributes, listeners, setNodeRef } = useDraggable({ id });

  return (
    <div ref={setNodeRef} className="zoneCard" data-widget-id={id}>
      <button
        type="button"
        className="dragHandle"
        {...attributes}
        {...listeners}
        aria-describedby={undefined}
        aria-label={uiText('drag_named', { name: widgetLabel(id) })}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Shift+ArrowLeft Shift+ArrowRight"
        onKeyDown={(event) => {
          if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          onMove(id, event.key, event.shiftKey);
        }}
      >
        <MdOutlineDragIndicator />
      </button>
      <span className="zoneCardLabel">{widgetLabel(id)}</span>
      <input
        type="checkbox"
        checked={enabled}
        aria-label={widgetLabel(id)}
        onChange={() => onToggle(id)}
      />
    </div>
  );
};

/** The space a card will land in: dim, bordered, and the size of a card. */
const Slot = ({ label, wide }) => (
  <span className={`dropSlot${wide ? ' dropSlot-wide' : ''}`}>
    {label ? <span className="dropSlotLabel">{label}</span> : null}
  </span>
);

/**
 * The line between two rows of the middle column. It is drawn only while a card is in
 * the air, and its negative margins cancel the space it takes, so the column does not
 * jump when the drag starts. It never opens: the opening is the slot row the drop
 * produces, which is the size of the widget on its way in.
 */
const Gap = () => <div className="dropGap" />;

export const Zone = ({ zone, rows, onToggle, onMove, isEnabled, activeId, slotOpen, slotWide }) => {
  useTranslationVersion();
  // Only the middle column needs lines between rows: on a rail the halves of a card
  // already mean before and after.
  const gaps = zone === 'center' && activeId !== null;

  return (
    <div className="widgetZone" data-zone={zone}>
      <span className="zoneTitle">{zoneTitle(zone)}</span>

      <div className="zoneCards">
        {rows.length === 0 ? (
          <span className={`dropSlot${slotOpen ? ' dropSlotOver' : ''}`}>
            <span className="dropSlotLabel">{uiText('drop_a_widget_here_94afdc')}</span>
          </span>
        ) : null}

        {rows.map((row, index) => {
          const key = row.find((id) => id !== SLOT) || `slot-${zone}`;
          const wide = (items) => items.every((id) => (id === SLOT ? slotWide : isFullWidth(id)));
          const divider = zone === 'center' && index > 0 && wide(rows[index - 1]) && !wide(row);

          return (
            <Fragment key={key}>
              {divider && <hr className="zoneSectionDivider" />}
              {gaps ? <Gap /> : null}

              <div className={`zoneRow${row.length === 1 ? ' isSingle' : ''}`}>
                {row.map((id) =>
                  id === SLOT ? (
                    <Slot key="slot" wide={slotWide} />
                  ) : (
                    <Card
                      key={id}
                      id={id}
                      enabled={isEnabled(id)}
                      onToggle={onToggle}
                      onMove={onMove}
                      dragging={id === activeId}
                    />
                  ),
                )}
              </div>
            </Fragment>
          );
        })}

        {gaps && rows.length ? <Gap /> : null}
      </div>
    </div>
  );
};

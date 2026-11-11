import { Fragment } from 'react';
import { DragOverlay } from '@dnd-kit/core';
import { MdOutlineDragIndicator } from 'react-icons/md';
import variables from 'config/variables';
import { ZONES } from 'utils/widgets';
import { widgetLabel } from './overviewLabels';
import OverviewPreview from './OverviewPreview';
import OverviewColumns from './OverviewColumns';
import { Zone } from './OverviewZone';
export default function OverviewBoard({
  columns,
  groups,
  profile,
  centerColumns,
  onToggle,
  onMove,
  isEnabled,
  activeId,
  slotWide,
  target,
  activeWidth,
}) {
  return (
    <>
      <div className="overviewZones">
        {ZONES.filter((zone) => zone !== 'center').map((zone) => (
          <div key={zone} className={`overviewSide overviewSide-${zone}`}>
            <Zone
              zone={zone}
              rows={columns[zone]}
              onToggle={onToggle}
              onMove={onMove}
              isEnabled={(id) => isEnabled(id)}
              activeId={activeId}
              slotOpen={target?.zone === zone && target.overId === null}
              slotWide={slotWide}
            />
          </div>
        ))}

        <div className="overviewPreview">
          <span className="zoneTitle">
            {variables.getMessage('modals.welcome.buttons.preview')}
          </span>
          <div className="tabPreview">
            {ZONES.map((zone) => (
              <Fragment key={zone}>
                <OverviewPreview
                  zone={zone}
                  groups={groups}
                  profile={profile}
                  secondLane={centerColumns.lane}
                  columnMode={centerColumns.mode}
                />
              </Fragment>
            ))}
          </div>
        </div>

        <div className="overviewBelow">
          <Zone
            zone="center"
            columnControl={
              <OverviewColumns
                count={centerColumns.count}
                onSelect={centerColumns.select}
                disabled={activeId !== null}
              />
            }
            rows={columns.center}
            onToggle={onToggle}
            onMove={onMove}
            isEnabled={(id) => isEnabled(id)}
            activeId={activeId}
            slotOpen={target?.zone === 'center' && target.overId === null}
            slotWide={slotWide}
          />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeId ? (
          <div
            className="zoneCard dragCard"
            style={activeWidth ? { width: activeWidth } : undefined}
          >
            <span className="dragHandle">
              <MdOutlineDragIndicator />
            </span>
            <span className="zoneCardLabel">{widgetLabel(activeId)}</span>
          </div>
        ) : null}
      </DragOverlay>
    </>
  );
}

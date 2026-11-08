import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MdOutlineDragIndicator } from 'react-icons/md';
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import variables from 'config/variables';
import { overviewRows } from './overviewLayout';
import { captureGeometry, readTarget, sameTarget } from './overviewGeometry';
import OverviewPreview from './OverviewPreview';
import { Zone } from './OverviewZone';
import { SLOT, widgetLabel } from './overviewLabels';
import { fromRows, placeRows } from './overviewDrop';
import { moveOverviewWithKeys } from './overviewKeyboard';
import {
  WIDGETS,
  ZONES,
  readOrder,
  readPlacement,
  readSecondLane,
  saveOrder,
  savePlacement,
  saveSecondLane,
  groupByZone,
  placementFromGroups,
  isWidgetEnabled,
  setWidgetEnabled,
  isFullWidth,
} from 'utils/widgets';

import EventBus from 'utils/eventbus';

const OverviewLayout = ({ profile }) => {
  useTranslationVersion();
  const [groups, setGroups] = useState(() =>
    groupByZone(readOrder(profile), readPlacement(profile)),
  );
  const [secondLane, setSecondLane] = useState(() => readSecondLane(profile));
  const [activeId, setActiveId] = useState(null);
  const [activeWidth, setActiveWidth] = useState(null);
  const [target, setTarget] = useState(null);
  const pointer = useRef({ x: 0, y: 0 });
  const geometry = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const findZone = useCallback((id) => ZONES.find((zone) => groups[zone].includes(id)), [groups]);

  const rowsFor = useCallback(
    (zone, insert) => {
      const base = overviewRows(groups[zone], secondLane, zone)
        .map((row) => row.filter((id) => id !== activeId))
        .filter((row) => row.length > 0);

      if (!target || target.zone !== zone) return base;

      const placed = placeRows({
        zone,
        rows: base,
        insert,
        overId: target.overId,
        side: target.side,
        index: target.index,
        insertWide: isFullWidth(activeId),
      });
      if (zone !== 'center') return placed;
      const wide = (row) =>
        row.every((id) => (id === insert ? isFullWidth(activeId) : isFullWidth(id)));
      return [...placed.filter(wide), ...placed.filter((row) => !wide(row))];
    },
    [groups, secondLane, activeId, target],
  );

  const clear = useCallback(() => {
    setActiveId(null);
    setActiveWidth(null);
    setTarget(null);
    geometry.current = null;
  }, []);

  /**
   * The pointer is followed directly, and the place it points at is read off the layout
   * as it stood when the drag began. Nothing here depends on the layout the drag itself
   * produces, so the target cannot flip back and forth.
   */
  const handleMove = (event) => {
    const { activatorEvent, delta } = event;

    if (activatorEvent?.clientX === undefined) return;

    pointer.current = { x: activatorEvent.clientX + delta.x, y: activatorEvent.clientY + delta.y };

    if (!geometry.current) geometry.current = captureGeometry();

    const next = readTarget(geometry.current, pointer.current);

    setTarget((current) => (sameTarget(current, next) ? current : next));
  };

  const handleDragEnd = () => {
    if (!activeId || !target) {
      clear();

      return;
    }

    const from = findZone(activeId);
    const to = target?.zone ?? from;

    if (!from || !to) {
      clear();

      return;
    }

    const center = fromRows(rowsFor('center', activeId));
    const placed = to === 'center' ? center.ids : fromRows(rowsFor(to, activeId)).ids;

    setGroups((previous) => ({
      ...previous,
      [from]: previous[from].filter((id) => id !== activeId),
      center: center.ids,
      ...(to === 'center' ? {} : { [to]: placed }),
    }));

    setSecondLane(center.lane);
    clear();
  };

  const toggleEnabled = (id) => {
    const widget = WIDGETS.find((item) => item.id === id);

    if (!widget) return;

    const current = isWidgetEnabled(id, profile);

    setWidgetEnabled(id, !current, profile);
    variables.stats.postEvent('setting', 'Widget toggle');
    EventBus.emit('refresh', 'widgets');
    // Checkbox state lives in localStorage, so the list is re-read rather than tracked twice.
    setGroups((previous) => ({ ...previous }));
  };

  const moveWithKeys = (id, key, shift) =>
    moveOverviewWithKeys({
      id,
      key,
      shift,
      zone: findZone(id),
      activeId,
      setGroups,
      setSecondLane,
    });

  // Persists on every change: order, the zone each widget sits in, and the middle lane.
  useEffect(() => {
    saveOrder(
      ZONES.flatMap((zone) => groups[zone]),
      profile,
    );
    savePlacement(placementFromGroups(groups), profile);
    saveSecondLane(
      secondLane.filter((id) => groups.center.includes(id) && !isFullWidth(id)),
      profile,
    );
    variables.stats.postEvent('setting', 'Widget placement');
    EventBus.emit('refresh', 'widgets');
  }, [groups, secondLane, profile]);

  const columns = useMemo(
    () =>
      ZONES.reduce((all, zone) => {
        all[zone] = rowsFor(zone, SLOT);

        return all;
      }, {}),
    [rowsFor],
  );

  // The opening is drawn at the size of the widget on its way in: a card takes one
  // column of the row, a full-width line takes the row.
  const slotWide = activeId ? isFullWidth(activeId) : false;

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={({ active }) => {
          const node = document.querySelector(`[data-widget-id="${active.id}"]`);
          const box = node?.getBoundingClientRect();

          geometry.current = captureGeometry();
          setActiveWidth(box ? box.width : null);
          setActiveId(active.id);
        }}
        onDragMove={handleMove}
        onDragEnd={handleDragEnd}
        onDragCancel={clear}
      >
        <div className="overviewZones">
          {ZONES.filter((zone) => zone !== 'center').map((zone) => (
            <div key={zone} className={`overviewSide overviewSide-${zone}`}>
              <Zone
                zone={zone}
                rows={columns[zone]}
                onToggle={toggleEnabled}
                onMove={moveWithKeys}
                isEnabled={(id) => isWidgetEnabled(id, profile)}
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
                    secondLane={secondLane}
                  />
                </Fragment>
              ))}
            </div>
          </div>

          <div className="overviewBelow">
            <Zone
              zone="center"
              rows={columns.center}
              onToggle={toggleEnabled}
              onMove={moveWithKeys}
              isEnabled={(id) => isWidgetEnabled(id, profile)}
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
      </DndContext>
    </>
  );
};

const Overview = () => {
  useTranslationVersion();
  const [profile, setProfile] = useState('standard');
  return (
    <>
      <div className="overviewHeader">
        <span className="mainTitle">
          {variables.getMessage('modals.main.marketplace.product.overview')}
        </span>
        <div className="overviewProfile" role="group" aria-label={uiText('workspace_layout')}>
          {['standard', 'focus'].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={profile === value}
              onClick={() => setProfile(value)}
            >
              {uiText(value === 'focus' ? 'workspace_focus' : 'workspace_standard')}
            </button>
          ))}
        </div>
      </div>
      <p className="overviewFocusHint">{uiText('workspace_layout_hint')}</p>
      <OverviewLayout key={profile} profile={profile} />
    </>
  );
};

export { Overview as default, Overview };

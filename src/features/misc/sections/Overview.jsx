import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import variables from 'config/variables';
import { overviewRows } from './overviewLayout';
import { captureGeometry, readTarget, sameTarget } from './overviewGeometry';
import { SLOT } from './overviewLabels';
import { fromRows, placeRows } from './overviewDrop';
import { moveOverviewWithKeys } from './overviewKeyboard';
import useOverviewPointer from './useOverviewPointer';
import useOverviewColumns from './useOverviewColumns';
import OverviewBoard from './OverviewBoard';
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
  const centerColumns = useOverviewColumns(profile, groups.center, secondLane, setSecondLane);
  const [activeId, setActiveId] = useState(null);
  const [activeWidth, setActiveWidth] = useState(null);
  const [target, setTarget] = useState(null);
  const { start: startPointer, read: readPointer, stop: stopPointer } = useOverviewPointer();
  const geometry = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const findZone = useCallback((id) => ZONES.find((zone) => groups[zone].includes(id)), [groups]);

  const rowsFor = useCallback(
    (zone, insert, destination = target, draggedId = activeId) => {
      const base = overviewRows(groups[zone], centerColumns.lane, zone)
        .map((row) => row.filter((id) => id !== draggedId))
        .filter((row) => row.length > 0);

      if (!destination || destination.zone !== zone) return base;

      const placed = placeRows({
        zone,
        rows: base,
        insert,
        overId: destination.overId,
        side: destination.side,
        index: destination.index,
        insertWide: isFullWidth(draggedId),
      });
      if (zone !== 'center') return placed;
      const wide = (row) =>
        row.every((id) => (id === insert ? isFullWidth(draggedId) : isFullWidth(id)));
      return [...placed.filter(wide), ...placed.filter((row) => !wide(row))];
    },
    [groups, centerColumns.lane, activeId, target],
  );

  const clear = useCallback(() => {
    setActiveId(null);
    setActiveWidth(null);
    setTarget(null);
    geometry.current = null;
    stopPointer();
  }, [stopPointer]);

  // Preview state may lag a fast release; always resolve the final drop from
  // the captured native pointer position rather than the last rendered slot.
  const currentTarget = () => {
    const point = readPointer();
    return geometry.current && point ? readTarget(geometry.current, point) : null;
  };
  const handleMove = () => {
    const next = currentTarget();
    setTarget((current) => (sameTarget(current, next) ? current : next));
  };

  const handleDragEnd = ({ active }) => {
    const id = active.id;
    const destination = currentTarget();
    if (!id || !destination || destination.overId === id) {
      clear();
      return;
    }

    const from = findZone(id);
    const to = destination.zone;

    if (!from || !to) {
      clear();

      return;
    }

    const center = fromRows(rowsFor('center', id, destination, id));
    const placed = to === 'center' ? center.ids : fromRows(rowsFor(to, id, destination, id)).ids;

    if (to === 'center' && !isFullWidth(id)) centerColumns.manual();
    setGroups((previous) => ({
      ...previous,
      [from]: previous[from].filter((widgetId) => widgetId !== id),
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

  const moveWithKeys = (id, key, shift) => {
    if (
      !activeId &&
      !isFullWidth(id) &&
      shift &&
      findZone(id) === 'center' &&
      ['ArrowLeft', 'ArrowRight'].includes(key)
    )
      centerColumns.manual();
    moveOverviewWithKeys({
      id,
      key,
      shift,
      zone: findZone(id),
      activeId,
      setGroups,
      setSecondLane,
    });
  };

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
        onDragStart={({ active, activatorEvent }) => {
          const node = document.querySelector(`[data-widget-id="${active.id}"]`);
          const box = node?.getBoundingClientRect();

          geometry.current = captureGeometry();
          startPointer(activatorEvent, node);
          setActiveWidth(box ? box.width : null);
          setActiveId(active.id);
        }}
        onDragMove={handleMove}
        onDragEnd={handleDragEnd}
        onDragCancel={clear}
      >
        <OverviewBoard
          columns={columns}
          groups={groups}
          profile={profile}
          centerColumns={centerColumns}
          onToggle={toggleEnabled}
          onMove={moveWithKeys}
          isEnabled={(id) => isWidgetEnabled(id, profile)}
          activeId={activeId}
          slotWide={slotWide}
          target={target}
          activeWidth={activeWidth}
        />
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

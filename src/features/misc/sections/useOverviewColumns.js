import { useState } from 'react';
import { readCenterColumns, saveCenterColumns, centerSecondLane } from 'utils/widgetColumns';
export default function useOverviewColumns(profile, ids, secondLane, setSecondLane) {
  const [mode, setMode] = useState(() => readCenterColumns(profile));
  const lane = centerSecondLane(ids, secondLane, mode);
  const select = (value) => {
    saveCenterColumns(value, profile);
    setMode(value);
    setSecondLane(centerSecondLane(ids, secondLane, value));
  };
  const manual = () => {
    saveCenterColumns('auto', profile);
    setMode('auto');
    setSecondLane(lane);
  };
  return { mode, lane, count: mode === '2' || lane.length ? '2' : '1', select, manual };
}

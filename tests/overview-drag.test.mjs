import { assert, test, server } from './regression-fixture.mjs';
const { captureScrollOrigins, adjustedPointer } = await server.ssrLoadModule(
  '/src/features/misc/sections/useOverviewPointer.js',
);
const { readTarget } = await server.ssrLoadModule(
  '/src/features/misc/sections/overviewGeometry.js',
);
const { placeRows, fromRows } = await server.ssrLoadModule(
  '/src/features/misc/sections/overviewDrop.js',
);
const column = (left, right, cards = []) => ({
  left,
  right,
  top: 100,
  bottom: 300,
  cards,
  gaps: [],
});
const geometry = {
  'top-left': column(0, 200, [{ id: 'planning', left: 0, right: 200, top: 120, bottom: 170 }]),
  'top-right': column(800, 1000),
};

test('Overview translates release coordinates into frozen geometry across nested scrolling', () => {
  const parent = { scrollLeft: 10, scrollTop: 40, parentElement: null };
  const node = { scrollLeft: 0, scrollTop: 0, parentElement: parent };
  const origins = captureScrollOrigins(node);
  parent.scrollTop = 120;
  parent.scrollLeft = 30;
  node.scrollTop = 15;
  const point = adjustedPointer({ point: { x: 880, y: 65 }, origins });
  assert.deepEqual(point, { x: 900, y: 160 });
  const destination = readTarget(geometry, point);
  assert.equal(destination.zone, 'top-right');
  const rows = placeRows({ zone: destination.zone, rows: [], insert: 'planning', ...destination });
  assert.deepEqual(fromRows(rows).ids, ['planning']);
  assert.equal(origins[1].top, 40, 'scroll origins remain frozen');
});

test('Overview resolves the final release independently of an earlier source preview', () => {
  const origins = [];
  const preview = readTarget(geometry, adjustedPointer({ point: { x: 100, y: 145 }, origins }));
  assert.equal(preview.zone, 'top-left');
  const drop = readTarget(geometry, adjustedPointer({ point: { x: 900, y: 145 }, origins }));
  assert.equal(drop.zone, 'top-right');
  assert.equal(preview.zone, 'top-left', 'resolving the drop does not mutate the preview');
});

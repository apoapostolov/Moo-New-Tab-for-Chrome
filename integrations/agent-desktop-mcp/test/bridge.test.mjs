import test from 'node:test';
import assert from 'node:assert/strict';
import { buildInvocation, resolveAgentDesktopBinary, toolDefinitions } from '../bridge.mjs';

test('lists only the fixed desktop tool surface', () => {
  assert.deepEqual(toolDefinitions.map(({ name }) => name), [
    'desktop_status', 'list_apps', 'list_windows', 'list_surfaces', 'snapshot', 'find', 'get', 'is', 'wait',
    'click_ref', 'type_text', 'set_value', 'clear', 'press_key', 'focus_window', 'desktop_operation',
  ]);
});

test('builds snapshot args without shell parsing', () => {
  assert.deepEqual(buildInvocation('snapshot', {
    app: 'Zen Twilight', window_id: 'w-8063382', max_depth: 5, interactive_only: true, compact: true,
  }), ['snapshot', '--app', 'Zen Twilight', '--window-id', 'w-8063382', '--max-depth', '5', '--interactive-only', '--compact']);
});

test('accepts only qualified snapshot refs for actions', () => {
  assert.deepEqual(buildInvocation('click_ref', { ref: '@s8f3k2p9:e12' }), ['click', '@s8f3k2p9:e12']);
  assert.throws(() => buildInvocation('click_ref', { ref: '@e12' }), /qualified ref/);
});

test('requires an explicit app or window for key presses', () => {
  assert.deepEqual(buildInvocation('press_key', { combo: 'ctrl+l', app: 'Zen Twilight' }), ['press', '--app', 'Zen Twilight', 'ctrl+l']);
  assert.throws(() => buildInvocation('press_key', { combo: 'ctrl+l' }), /requires app or window_id/);
});

test('focus selects exactly one target', () => {
  assert.deepEqual(buildInvocation('focus_window', { window_id: 'w-17' }), ['focus-window', '--window-id', 'w-17']);
  assert.throws(() => buildInvocation('focus_window', {}), /exactly one/);
  assert.throws(() => buildInvocation('focus_window', { app: 'Zen', title: 'Settings' }), /exactly one/);
});

test('bounds accessibility snapshots and text input', () => {
  assert.throws(() => buildInvocation('snapshot', { max_depth: 129 }), /max_depth/);
  assert.throws(() => buildInvocation('type_text', { ref: '@s1:e1', text: 'x'.repeat(10001) }), /text/);
});

test('resolves the Windows native binary or an explicit override', () => {
  assert.equal(
    resolveAgentDesktopBinary({ APPDATA: 'C:\\Users\\someone\\AppData\\Roaming' }, 'win32', 'x64'),
    'C:\\Users\\someone\\AppData\\Roaming\\npm\\node_modules\\agent-desktop\\bin\\agent-desktop-win32-x64.exe',
  );
  assert.equal(resolveAgentDesktopBinary({ AGENT_DESKTOP_BIN: 'D:\\tools\\agent-desktop.exe' }, 'win32', 'x64'), 'D:\\tools\\agent-desktop.exe');
});

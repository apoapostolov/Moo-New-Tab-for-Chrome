import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const refPattern = /^@[A-Za-z0-9_-]+:e\d+$/;
const windowPattern = /^w-\d+$/;
const maxTextLength = 10000;
const maxOutputBytes = 12 * 1024 * 1024;
const surfaces = new Set([
  'window', 'focused', 'menu', 'menubar', 'sheet', 'popover', 'alert', 'desktop', 'taskbar',
  'system-tray', 'quick-settings', 'notification-center', 'toolbar', 'dock', 'spotlight',
  'menu-bar-extras', 'system-tray-overflow', 'start-menu', 'action-center',
]);

function stringArg(value, label, { max = 512, allowEmpty = false } = {}) {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max || value.includes('\0'))
    throw new TypeError(`${label} must be a ${allowEmpty ? 'string' : 'non-empty string'} of at most ${max} characters`);
  return value;
}

function windowId(value) {
  const id = stringArg(value, 'window_id', { max: 64 });
  if (!windowPattern.test(id)) throw new TypeError('window_id must come from agent-desktop list-windows');
  return id;
}

function ref(value) {
  const id = stringArg(value, 'ref', { max: 128 });
  if (!refPattern.test(id)) throw new TypeError('ref must be a qualified ref from the latest agent-desktop snapshot');
  return id;
}

function integerArg(value, label, { min = 0, max = 300000 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new TypeError(`${label} must be an integer from ${min} to ${max}`);
  return String(value);
}

function signedInteger(value, label, { min = -100000, max = 100000 } = {}) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new TypeError(`${label} must be an integer from ${min} to ${max}`);
  return String(value);
}

function point(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must contain integer x and y coordinates`);
  return `${signedInteger(value.x, `${label}.x`)},${signedInteger(value.y, `${label}.y`)}`;
}

function requireHeaded(args, operation) {
  if (args.headed !== true) throw new TypeError(`${operation} requires headed=true because it uses physical input or opens a foreground system surface`);
}

function oneWindowTarget(args, operation) {
  const selected = ['app', 'window_id'].filter((key) => args[key] !== undefined);
  if (selected.length !== 1) throw new TypeError(`${operation} requires exactly one of app or window_id`);
  return args.app !== undefined ? ['--app', stringArg(args.app, 'app')] : ['--window-id', windowId(args.window_id)];
}

function appendString(argv, args, key, flag, options) {
  if (args[key] !== undefined) argv.push(flag, stringArg(args[key], key, options));
}

function appendOption(argv, flag, value) {
  const text = String(value);
  if (text.startsWith('-')) argv.push(`${flag}=${text}`);
  else argv.push(flag, text);
}

function appendScope(argv, args) {
  appendString(argv, args, 'app', '--app');
  if (args.window_id !== undefined) argv.push('--window-id', windowId(args.window_id));
}

function appendTreeScope(argv, args) {
  if (args.root !== undefined && args.surface !== undefined)
    throw new TypeError('root and surface cannot be combined');
  appendScope(argv, args);
  if (args.root !== undefined) argv.push('--root', ref(args.root));
  if (args.surface !== undefined) {
    const surface = stringArg(args.surface, 'surface', { max: 40 });
    if (!surfaces.has(surface)) throw new TypeError(`unsupported surface: ${surface}`);
    argv.push('--surface', surface);
  }
}

function buildExtendedOperation(args) {
  const operation = stringArg(args.operation, 'operation', { max: 40 });
  const commonWait = ['wait_for', 'wait_for_gone', 'wait_timeout_ms'];
  const allowedFields = {
    screenshot: ['app', 'window_id', 'screen'], list_displays: [], open_system_surface: ['surface', 'headed'],
    double_click: ['ref', 'headed', 'timeout_ms', ...commonWait], triple_click: ['ref', 'headed', 'timeout_ms', ...commonWait],
    right_click: ['ref', 'headed', 'timeout_ms', ...commonWait], focus_ref: ['ref', 'headed', 'timeout_ms', ...commonWait],
    select: ['ref', 'value', 'headed', 'timeout_ms', ...commonWait], toggle: ['ref', 'headed', 'timeout_ms', ...commonWait],
    check: ['ref', 'headed', 'timeout_ms', ...commonWait], uncheck: ['ref', 'headed', 'timeout_ms', ...commonWait],
    expand: ['ref', 'headed', 'timeout_ms', ...commonWait], collapse: ['ref', 'headed', 'timeout_ms', ...commonWait],
    scroll: ['ref', 'direction', 'amount', 'headed', 'timeout_ms', ...commonWait], scroll_to: ['ref', 'headed', 'timeout_ms', ...commonWait],
    hover: ['ref', 'point', 'headed', 'timeout_ms', ...commonWait],
    drag: ['from_ref', 'from_point', 'to_ref', 'to_point', 'headed', 'duration_ms', 'drop_delay_ms', 'timeout_ms', ...commonWait, 'wait_for_scope'],
    mouse_move: ['point', 'headed'], mouse_click: ['point', 'headed', 'button', 'count', 'modifiers'],
    mouse_wheel: ['x', 'y', 'headed', 'dx', 'dy', 'modifiers'],
    launch_app: ['app', 'args', 'env', 'cwd', 'activate', 'no_attach', 'cdp', 'cdp_port', 'timeout_ms'],
    close_app: ['app', 'force'], resize_window: ['app', 'window_id', 'width', 'height', 'headed'],
    move_window: ['app', 'window_id', 'x', 'y', 'headed'], minimize: ['app', 'window_id', 'headed'],
    maximize: ['app', 'window_id', 'headed'], restore: ['app', 'window_id', 'headed'],
    list_notifications: ['app', 'text', 'limit', 'headed'],
    dismiss_notification: ['index', 'expected_app', 'expected_title', 'headed'],
    dismiss_all_notifications: ['app', 'headed'], notification_action: ['index', 'action', 'expected_app', 'expected_title', 'headed'],
    clipboard_get: ['format'], clipboard_set: ['text', 'image_path', 'file_urls'], clipboard_clear: [],
    permissions: ['request', 'guide'], version: [], session_start: ['name', 'no_trace', 'screenshots', 'cursor', 'multi_agent'],
    session_end: ['target_session_id'], session_list: [], session_gc: ['ended_only', 'older_than_seconds'],
    trace_show: ['limit', 'event_prefix'], trace_export: ['limit', 'output_path'],
    cursor_overlay_enable: ['label', 'fill', 'rim', 'accent', 'size', 'max_words', 'image_path', 'pointer_image_path', 'hotspot', 'pointer_hotspot', 'travel_min_ms', 'travel_max_ms', 'bow', 'overshoot', 'tremor', 'dwell_ms', 'motion_seed', 'no_ripple', 'no_highlight', 'multi_agent'],
    cursor_overlay_disable: [], desktop_docs: ['skill', 'reference'], batch: ['steps', 'stop_on_error', 'timeout_ms', 'headed'],
  };
  const allowed = allowedFields[operation];
  if (!allowed) throw new TypeError(`Unknown desktop operation: ${operation}`);
  for (const key of Object.keys(args)) {
    if (!['operation', 'session_id', 'agent_id', 'trace_path', 'trace_strict'].includes(key) && !allowed.includes(key))
      throw new TypeError(`${key} is not supported for ${operation}`);
  }
  for (const key of ['activate', 'no_attach', 'cdp', 'force', 'request', 'guide', 'no_trace', 'screenshots', 'cursor', 'multi_agent', 'ended_only', 'no_ripple', 'no_highlight', 'stop_on_error']) {
    if (args[key] !== undefined && typeof args[key] !== 'boolean') throw new TypeError(`${key} must be a boolean`);
  }
  const withHeaded = (command) => args.headed === true ? ['--headed', command] : [command];
  const target = (command) => [...withHeaded(command), ...oneWindowTarget(args, operation)];
  const refAction = (command, allowHeaded = true) => {
    const argv = allowHeaded ? withHeaded(command) : [command];
    argv.push(ref(args.ref));
    if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
    return argv;
  };
  const textValue = (key, limit = maxTextLength) => stringArg(args[key], key, { max: limit, allowEmpty: true });
  const addWindowAndApp = (argv) => {
    appendString(argv, args, 'app', '--app');
    if (args.window_id !== undefined) argv.push('--window-id', windowId(args.window_id));
    return argv;
  };
  const overlayWait = (argv) => argv;

  switch (operation) {
    case 'screenshot': {
      if (args.screen !== undefined && (args.app !== undefined || args.window_id !== undefined))
        throw new TypeError('screenshot accepts screen or app/window scope, not both');
      const argv = ['screenshot'];
      addWindowAndApp(argv);
      if (args.screen !== undefined) argv.push('--screen', integerArg(args.screen, 'screen', { max: 64 }));
      return argv;
    }
    case 'list_displays': return ['list-displays'];
    case 'open_system_surface': {
      requireHeaded(args, operation);
      const surface = stringArg(args.surface, 'surface', { max: 32 });
      if (!['start-menu', 'taskbar', 'system-tray', 'system-tray-overflow', 'action-center'].includes(surface))
        throw new TypeError('unsupported system surface for open-system-surface');
      return ['--headed', 'open-system-surface', '--surface', surface];
    }
    case 'double_click':
    case 'triple_click':
      requireHeaded(args, operation);
      return overlayWait(refAction(operation === 'double_click' ? 'double-click' : 'triple-click'));
    case 'right_click': return overlayWait(refAction('right-click'));
    case 'focus_ref': return overlayWait(refAction('focus'));
    case 'select': return overlayWait([...refAction('select'), textValue('value')]);
    case 'toggle':
    case 'check':
    case 'uncheck':
    case 'expand':
    case 'collapse':
    case 'scroll_to':
      return overlayWait(refAction(operation === 'scroll_to' ? 'scroll-to' : operation));
    case 'scroll': {
      const argv = refAction('scroll');
      if (args.direction !== undefined) {
        if (!['up', 'down', 'left', 'right'].includes(args.direction)) throw new TypeError('invalid scroll direction');
        argv.push('--direction', args.direction);
      }
      if (args.amount !== undefined) argv.push('--amount', integerArg(args.amount, 'amount', { min: 1, max: 1000 }));
      return overlayWait(argv);
    }
    case 'hover': {
      requireHeaded(args, operation);
      if ((args.ref === undefined) === (args.point === undefined)) throw new TypeError('hover requires exactly one of ref or point');
      const argv = ['--headed', 'hover'];
      if (args.ref !== undefined) argv.push(ref(args.ref));
      else appendOption(argv, '--xy', point(args.point, 'point'));
      if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
      return overlayWait(argv);
    }
    case 'drag': {
      requireHeaded(args, operation);
      const fromCount = Number(args.from_ref !== undefined) + Number(args.from_point !== undefined);
      const toCount = Number(args.to_ref !== undefined) + Number(args.to_point !== undefined);
      if (fromCount !== 1 || toCount !== 1) throw new TypeError('drag requires exactly one from_ref/from_point and one to_ref/to_point');
      const argv = ['--headed', 'drag'];
      if (args.from_ref !== undefined) argv.push('--from', ref(args.from_ref));
      else appendOption(argv, '--from-xy', point(args.from_point, 'from_point'));
      if (args.to_ref !== undefined) argv.push('--to', ref(args.to_ref));
      else appendOption(argv, '--to-xy', point(args.to_point, 'to_point'));
      if (args.duration_ms !== undefined) argv.push('--duration', integerArg(args.duration_ms, 'duration_ms', { max: 60000 }));
      if (args.drop_delay_ms !== undefined) argv.push('--drop-delay', integerArg(args.drop_delay_ms, 'drop_delay_ms', { max: 10000 }));
      if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
      return overlayWait(argv);
    }
    case 'mouse_move':
    case 'mouse_click':
    case 'mouse_wheel': {
      requireHeaded(args, operation);
      const argv = ['--headed', operation.replaceAll('_', '-')];
      if (operation === 'mouse_move' || operation === 'mouse_click') appendOption(argv, '--xy', point(args.point, 'point'));
      else {
        appendOption(argv, '--x', signedInteger(args.x, 'x'));
        appendOption(argv, '--y', signedInteger(args.y, 'y'));
        if (args.dx !== undefined) appendOption(argv, '--dx', signedInteger(args.dx, 'dx', { min: -10000, max: 10000 }));
        if (args.dy !== undefined) appendOption(argv, '--dy', signedInteger(args.dy, 'dy', { min: -10000, max: 10000 }));
      }
      if (operation === 'mouse_click') {
        const button = args.button ?? 'left';
        if (!['left', 'right', 'middle'].includes(button)) throw new TypeError('invalid mouse button');
        argv.push('--button', button);
        if (args.count !== undefined) argv.push('--count', integerArg(args.count, 'count', { min: 1, max: 10 }));
      }
      if (operation === 'mouse_wheel' && args.modifiers !== undefined) {
        if (!Array.isArray(args.modifiers) || args.modifiers.some((item) => !['shift', 'meta', 'ctrl', 'alt', 'cmd'].includes(item))) throw new TypeError('invalid mouse modifier');
        for (const modifier of args.modifiers) argv.push('--modifiers', modifier);
      }
      return overlayWait(argv);
    }
    case 'launch_app': {
      const app = stringArg(args.app, 'app', { max: 2048 });
      const argv = ['launch', app];
      if (args.args !== undefined) {
        if (!Array.isArray(args.args) || args.args.length > 20) throw new TypeError('args must be an array of at most 20 strings');
        for (const argument of args.args) {
          const safeArg = stringArg(argument, 'args[]', { max: 2048, allowEmpty: true });
          argv.push(safeArg.startsWith('-') ? `--arg=${safeArg}` : '--arg', ...(safeArg.startsWith('-') ? [] : [safeArg]));
        }
      }
      if (args.env !== undefined) {
        if (!Array.isArray(args.env) || args.env.length > 20) throw new TypeError('env must be an array of at most 20 KEY=VALUE strings');
        for (const entry of args.env) {
          const pair = stringArg(entry, 'env[]', { max: 4096 });
          if (!/^[A-Za-z_][A-Za-z0-9_]*=/.test(pair)) throw new TypeError('env entries must use KEY=VALUE form');
          argv.push('--env', pair);
        }
      }
      if (args.cwd !== undefined) argv.push('--cwd', stringArg(args.cwd, 'cwd', { max: 4096 }));
      if (args.activate === true) argv.push('--activate');
      if (args.no_attach === true) argv.push('--no-attach');
      if (args.cdp_port !== undefined) {
        const port = integerArg(args.cdp_port, 'cdp_port', { max: 65535 });
        argv.push('--cdp', port);
      } else if (args.cdp === true) argv.push('--cdp');
      if (args.timeout_ms !== undefined) argv.push('--timeout', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
      return argv;
    }
    case 'close_app': {
      const argv = ['close-app', stringArg(args.app, 'app')];
      if (args.force === true) argv.push('--force');
      return argv;
    }
    case 'resize_window': {
      const argv = [...target('resize-window'), '--width', integerArg(args.width, 'width', { min: 1, max: 20000 }), '--height', integerArg(args.height, 'height', { min: 1, max: 20000 })];
      return argv;
    }
    case 'move_window': {
      const argv = [...target('move-window')];
      appendOption(argv, '--x', signedInteger(args.x, 'x'));
      appendOption(argv, '--y', signedInteger(args.y, 'y'));
      return argv;
    }
    case 'minimize':
    case 'maximize':
    case 'restore': return target(operation);
    case 'list_notifications': {
      const argv = withHeaded('list-notifications');
      appendString(argv, args, 'app', '--app');
      appendString(argv, args, 'text', '--text');
      if (args.limit !== undefined) argv.push('--limit', integerArg(args.limit, 'limit', { min: 1, max: 1000 }));
      return argv;
    }
    case 'dismiss_notification':
    case 'notification_action': {
      requireHeaded(args, operation);
      if (args.expected_app === undefined && args.expected_title === undefined) throw new TypeError(`${operation} requires expected_app or expected_title from the latest notification listing`);
      const index = integerArg(args.index, 'index', { min: 1, max: 1000000 });
      const argv = ['--headed', operation === 'dismiss_notification' ? 'dismiss-notification' : 'notification-action', index];
      if (operation === 'notification_action') argv.push(stringArg(args.action, 'action'));
      if (args.expected_app !== undefined) argv.push('--expected-app', stringArg(args.expected_app, 'expected_app'));
      if (args.expected_title !== undefined) argv.push('--expected-title', stringArg(args.expected_title, 'expected_title'));
      return argv;
    }
    case 'dismiss_all_notifications': {
      requireHeaded(args, operation);
      const argv = ['--headed', 'dismiss-all-notifications'];
      appendString(argv, args, 'app', '--app');
      return argv;
    }
    case 'clipboard_get': {
      const format = args.format ?? 'text';
      if (!['text', 'auto', 'image', 'file-urls'].includes(format)) throw new TypeError('unsupported clipboard format');
      return ['clipboard-get', '--format', format];
    }
    case 'clipboard_set': {
      if (args.file_urls !== undefined && !Array.isArray(args.file_urls)) throw new TypeError('file_urls must be an array of paths');
      const sources = Number(args.text !== undefined) + Number(args.image_path !== undefined) + Number(Array.isArray(args.file_urls) && args.file_urls.length > 0);
      if (sources !== 1) throw new TypeError('clipboard_set requires exactly one of text, image_path, or file_urls');
      if (args.text !== undefined) return ['clipboard-set', textValue('text')];
      if (args.image_path !== undefined) return ['clipboard-set', '--image', stringArg(args.image_path, 'image_path', { max: 4096 })];
      if (!Array.isArray(args.file_urls) || args.file_urls.length > 20) throw new TypeError('file_urls must contain at most 20 paths');
      return ['clipboard-set', ...args.file_urls.flatMap((value) => ['--file-url', stringArg(value, 'file_urls[]', { max: 4096 })])];
    }
    case 'clipboard_clear': return ['clipboard-clear'];
    case 'permissions': {
      if (args.request === true && args.guide === true) throw new TypeError('permissions request and guide are separate workflows');
      const argv = ['permissions'];
      if (args.request === true) argv.push('--request');
      if (args.guide === true) argv.push('--guide');
      return argv;
    }
    case 'version': return ['version'];
    case 'session_start': {
      if (args.no_trace === true && args.screenshots === true) throw new TypeError('screenshots require session tracing; omit no_trace');
      const argv = ['session', 'start'];
      appendString(argv, args, 'name', '--name', { max: 128 });
      if (args.no_trace === true) argv.push('--no-trace');
      if (args.screenshots === true) argv.push('--screenshots');
      if (args.cursor === true) argv.push('--cursor');
      if (args.multi_agent === true) argv.push('--multi-agent');
      return argv;
    }
    case 'session_end': return args.target_session_id === undefined ? ['session', 'end'] : ['session', 'end', stringArg(args.target_session_id, 'target_session_id', { max: 128 })];
    case 'session_list': return ['session', 'list'];
    case 'session_gc': {
      const argv = ['session', 'gc'];
      if (args.ended_only === true) argv.push('--ended');
      if (args.older_than_seconds !== undefined) argv.push('--older-than', integerArg(args.older_than_seconds, 'older_than_seconds', { max: 315360000 }));
      return argv;
    }
    case 'trace_show': {
      const argv = ['trace', 'show'];
      if (args.limit !== undefined) argv.push('--limit', integerArg(args.limit, 'limit', { max: 100000 }));
      appendString(argv, args, 'event_prefix', '--event', { max: 100 });
      return argv;
    }
    case 'trace_export': {
      const argv = ['trace', 'export'];
      if (args.output_path !== undefined) argv.push('--out', stringArg(args.output_path, 'output_path', { max: 4096 }));
      if (args.limit !== undefined) argv.push('--limit', integerArg(args.limit, 'limit', { max: 100000 }));
      return argv;
    }
    case 'cursor_overlay_enable': {
      if (args.multi_agent === true && args.agent_id !== undefined) throw new TypeError('configure a multi-agent session cursor without agent_id, or configure a single agent cursor with agent_id');
      const argv = ['cursor-overlay', 'enable'];
      appendString(argv, args, 'label', '--label', { max: 120 });
      for (const key of ['fill', 'rim', 'accent']) {
        if (args[key] !== undefined) {
          const color = stringArg(args[key], key, { max: 16 });
          if (!/^#[A-Fa-f0-9]{6}$/.test(color)) throw new TypeError(`${key} must be a six-digit hex color such as #4299FF`);
          argv.push(`--${key}`, color);
        }
      }
      if (args.size !== undefined) argv.push('--size', String(numberArg(args.size, 'size', 0.5, 4)));
      if (args.max_words !== undefined) argv.push('--max-words', integerArg(args.max_words, 'max_words', { min: 1, max: 12 }));
      if (args.image_path !== undefined) argv.push('--image', stringArg(args.image_path, 'image_path', { max: 4096 }));
      if (args.pointer_image_path !== undefined) argv.push('--pointer-image', stringArg(args.pointer_image_path, 'pointer_image_path', { max: 4096 }));
      if (args.hotspot !== undefined) argv.push('--hotspot', point(args.hotspot, 'hotspot'));
      if (args.pointer_hotspot !== undefined) argv.push('--pointer-hotspot', point(args.pointer_hotspot, 'pointer_hotspot'));
      if (args.travel_min_ms !== undefined || args.travel_max_ms !== undefined) {
        const min = integerArg(args.travel_min_ms ?? 90, 'travel_min_ms', { min: 30, max: 10000 });
        const max = integerArg(args.travel_max_ms ?? 320, 'travel_max_ms', { min: 30, max: 10000 });
        if (Number(min) > Number(max)) throw new TypeError('travel_min_ms must not exceed travel_max_ms');
        argv.push('--travel-ms', `${min},${max}`);
      }
      if (args.bow !== undefined) argv.push('--bow', String(numberArg(args.bow, 'bow', 0, 3)));
      if (args.overshoot !== undefined) argv.push('--overshoot', String(numberArg(args.overshoot, 'overshoot', 0, 0.15)));
      if (args.tremor !== undefined) argv.push('--tremor', String(numberArg(args.tremor, 'tremor', 0, 4)));
      if (args.dwell_ms !== undefined) argv.push('--dwell-ms', integerArg(args.dwell_ms, 'dwell_ms', { max: 300 }));
      if (args.motion_seed !== undefined) argv.push('--motion-seed', integerArg(args.motion_seed, 'motion_seed', { max: 2147483647 }));
      if (args.no_ripple === true) argv.push('--no-ripple');
      if (args.no_highlight === true) argv.push('--no-highlight');
      if (args.multi_agent === true) argv.push('--multi-agent');
      return argv;
    }
    case 'cursor_overlay_disable': return ['cursor-overlay', 'disable'];
    case 'desktop_docs': {
      const skill = args.skill ?? 'desktop';
      if (skill === 'path') return ['skills', 'path'];
      if (skill === 'list') return ['skills'];
      if (!['desktop', 'platform'].includes(skill)) throw new TypeError('skill must be desktop, platform, or list');
      return args.reference === undefined ? ['skills', 'get', skill] : ['skills', 'get', skill, stringArg(args.reference, 'reference', { max: 200 })];
    }
    case 'batch': {
      const entries = buildBatchArgs(args.steps);
      if (entries.some(({ command }) => ['double-click', 'triple-click'].includes(command)) && args.headed !== true)
        throw new TypeError('batch double-click and triple-click entries require headed=true');
      const argv = [...withHeaded('batch'), JSON.stringify(entries)];
      if (args.stop_on_error !== false) argv.push('--stop-on-error');
      if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1, max: 300000 }));
      return argv;
    }
    default: throw new TypeError(`Unknown desktop operation: ${operation}`);
  }
}

function numberArg(value, label, min, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw new TypeError(`${label} must be a number from ${min} to ${max}`);
  return value;
}

function buildBatchArgs(steps) {
  const fields = {
    snapshot: ['app', 'window_id', 'max_depth', 'timeout_ms', 'skeleton', 'interactive_only', 'compact', 'root', 'surface', 'include_bounds'],
    find: ['app', 'window_id', 'role', 'name', 'value', 'text', 'description', 'native_id', 'states', 'exact', 'root', 'surface', 'count', 'first', 'last', 'nth', 'limit', 'timeout_ms'],
    get: ['ref_id', 'property'], is: ['ref_id', 'property'], click: ['ref_id'], 'double-click': ['ref_id'], 'triple-click': ['ref_id'], 'right-click': ['ref_id'],
    type: ['ref_id', 'text'], 'set-value': ['ref_id', 'value'], clear: ['ref_id'], select: ['ref_id', 'value'],
    toggle: ['ref_id'], check: ['ref_id'], uncheck: ['ref_id'], expand: ['ref_id'], collapse: ['ref_id'], 'scroll-to': ['ref_id'],
    scroll: ['ref_id', 'direction', 'amount'], press: ['combo', 'app', 'window_id'],
    wait: ['ms', 'element', 'predicate', 'action', 'value', 'window', 'text', 'app', 'count', 'menu', 'menu_closed', 'notification', 'event', 'window_id', 'timeout'],
  };
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 30) throw new TypeError('steps must contain 1 to 30 supported batch entries');
  return steps.map((step, index) => {
    if (!step || typeof step !== 'object' || Array.isArray(step) || typeof step.command !== 'string' || !step.args || typeof step.args !== 'object' || Array.isArray(step.args))
      throw new TypeError(`steps[${index}] must contain a command and args object`);
    const allowed = fields[step.command];
    if (!allowed) throw new TypeError(`unsupported batch command: ${step.command}`);
    const args = { ...step.args };
    if (Object.keys(args).some((key) => key !== 'session' && !allowed.includes(key))) throw new TypeError(`unsupported argument in batch step ${index}`);
    const refCommands = ['click', 'double-click', 'triple-click', 'right-click', 'type', 'set-value', 'clear', 'select', 'toggle', 'check', 'uncheck', 'expand', 'collapse', 'scroll-to', 'scroll', 'get', 'is'];
    if (refCommands.includes(step.command)) args.ref_id = ref(args.ref_id);
    if (step.command === 'type' && args.text === undefined) throw new TypeError(`steps[${index}] type requires text`);
    if (['set-value', 'select'].includes(step.command) && args.value === undefined) throw new TypeError(`steps[${index}] ${step.command} requires value`);
    if (step.command === 'press' && args.combo === undefined) throw new TypeError(`steps[${index}] press requires combo`);
    if (step.command === 'press') {
      const targetCount = Number(args.app !== undefined) + Number(args.window_id !== undefined);
      if (targetCount !== 1) throw new TypeError(`steps[${index}] press requires exactly one app or window_id target`);
    }
    if (step.command === 'find' && !['role', 'name', 'value', 'text', 'description', 'native_id'].some((key) => args[key] !== undefined) && !args.states?.length)
      throw new TypeError(`steps[${index}] find requires a match filter`);
    if (step.command === 'wait') {
      const modes = ['ms', 'element', 'window', 'text', 'menu', 'menu_closed', 'notification', 'event'].filter((key) => args[key] !== undefined && args[key] !== false);
      if (modes.length !== 1) throw new TypeError(`steps[${index}] wait requires exactly one wait mode`);
      if (args.element !== undefined) args.element = ref(args.element);
      if (args.window_id !== undefined) args.window_id = windowId(args.window_id);
    }
    if (step.command === 'press' && args.window_id !== undefined) args.window_id = windowId(args.window_id);
    if (step.command === 'snapshot' || step.command === 'find') {
      if (args.window_id !== undefined) args.window_id = windowId(args.window_id);
      if (args.root !== undefined) args.root = ref(args.root);
      if (args.surface !== undefined && !surfaces.has(stringArg(args.surface, 'surface', { max: 40 }))) throw new TypeError(`unsupported surface in batch step ${index}`);
      if (args.root !== undefined && args.surface !== undefined) throw new TypeError(`steps[${index}] root and surface cannot be combined`);
      if (step.command === 'snapshot' && args.skeleton === true && args.surface !== undefined) throw new TypeError(`steps[${index}] must not skeleton a surface`);
    }
    for (const key of ['app', 'role', 'name', 'value', 'text', 'description', 'native_id', 'combo', 'property', 'direction', 'predicate', 'action', 'window', 'event']) {
      if (args[key] !== undefined) stringArg(args[key], `steps[${index}].${key}`, { max: key === 'text' || key === 'value' ? maxTextLength : 2048, allowEmpty: key === 'text' || key === 'value' });
    }
    if (args.session !== undefined) stringArg(args.session, `steps[${index}].session`, { max: 128 });
    for (const key of ['max_depth', 'timeout_ms', 'nth', 'limit', 'amount', 'ms', 'timeout']) {
      if (args[key] !== undefined) integerArg(args[key], `steps[${index}].${key}`, { min: key === 'nth' || key === 'limit' || key === 'ms' ? 0 : 1, max: key === 'max_depth' ? 128 : key === 'limit' ? 10000 : 300000 });
    }
    if (args.count !== undefined) {
      if (step.command === 'wait') integerArg(args.count, `steps[${index}].count`, { min: 1, max: 1000000 });
      else if (step.command === 'find' && typeof args.count !== 'boolean') throw new TypeError(`steps[${index}].count must be a boolean`);
    }
    for (const key of ['skeleton', 'interactive_only', 'compact', 'include_bounds', 'exact', 'first', 'last', 'menu', 'menu_closed', 'notification']) {
      if (args[key] !== undefined && typeof args[key] !== 'boolean') throw new TypeError(`steps[${index}].${key} must be a boolean`);
    }
    if (args.states !== undefined && (!Array.isArray(args.states) || args.states.length > 16 || args.states.some((state) => typeof state !== 'string' || !/^[A-Za-z_-]+(?:=(?:true|false))?$/.test(state))))
      throw new TypeError(`steps[${index}].states must contain state tokens`);
    if (step.command === 'get' && args.property !== undefined && !['text', 'value', 'title', 'bounds', 'role', 'states'].includes(args.property))
      throw new TypeError(`steps[${index}] has an unsupported get property`);
    if (step.command === 'is' && args.property !== undefined && !['visible', 'enabled', 'checked', 'focused', 'expanded', 'selected'].includes(args.property))
      throw new TypeError(`steps[${index}] has an unsupported is property`);
    return { command: step.command, args };
  });
}

function buildCommandInvocation(name, args = {}) {
  if (!args || typeof args !== 'object' || Array.isArray(args)) throw new TypeError('tool arguments must be an object');
  if (args.headed !== undefined && typeof args.headed !== 'boolean') throw new TypeError('headed must be a boolean');
  const withHeaded = (command) => args.headed === true ? ['--headed', command] : [command];
  switch (name) {
    case 'desktop_status':
      return ['status'];
    case 'list_apps':
      return ['list-apps', ...(args.app === undefined ? [] : ['--app', stringArg(args.app, 'app')])];
    case 'list_windows': {
      const argv = ['list-windows'];
      if (args.app !== undefined) argv.push('--app', stringArg(args.app, 'app'));
      return argv;
    }
    case 'snapshot': {
      const argv = ['snapshot'];
      appendTreeScope(argv, args);
      if (args.max_depth !== undefined) argv.push('--max-depth', integerArg(args.max_depth, 'max_depth', { min: 1, max: 128 }));
      if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
      if (args.skeleton === true) argv.push('--skeleton');
      if (args.interactive_only === true) argv.push('--interactive-only');
      if (args.compact === true) argv.push('--compact');
      if (args.include_bounds === true) argv.push('--include-bounds');
      return argv;
    }
    case 'find': {
      const filters = ['role', 'name', 'value', 'text', 'description', 'native_id'];
      if (!filters.some((key) => args[key] !== undefined) && !(Array.isArray(args.states) && args.states.length))
        throw new TypeError('find requires at least one match filter');
      if (args.states !== undefined && (!Array.isArray(args.states) || args.states.length === 0))
        throw new TypeError('states must be a non-empty array of state tokens');
      const selectors = ['count', 'first', 'last', 'nth'].filter((key) => args[key] !== undefined && args[key] !== false);
      if (selectors.length > 1) throw new TypeError('find accepts only one of count, first, last or nth');
      const argv = ['find'];
      appendTreeScope(argv, args);
      for (const key of ['role', 'name', 'value', 'text', 'description']) appendString(argv, args, key, `--${key}`);
      if (args.native_id !== undefined) appendString(argv, args, 'native_id', '--native-id');
      if (args.states !== undefined) {
        if (!Array.isArray(args.states) || args.states.length === 0 || args.states.some((state) => typeof state !== 'string' || !/^[A-Za-z_-]+(?:=(?:true|false))?$/.test(state)))
          throw new TypeError('states must be a non-empty array of state tokens');
        for (const state of args.states) argv.push('--state', state);
      }
      if (args.exact === true) argv.push('--exact');
      if (args.count === true) argv.push('--count');
      if (args.first === true) argv.push('--first');
      if (args.last === true) argv.push('--last');
      if (args.nth !== undefined) argv.push('--nth', integerArg(args.nth, 'nth', { max: 1000000 }));
      if (args.limit !== undefined) argv.push('--limit', integerArg(args.limit, 'limit', { max: 10000 }));
      if (args.timeout_ms !== undefined) argv.push('--timeout-ms', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 }));
      return argv;
    }
    case 'get': {
      const property = args.property ?? 'text';
      if (!['text', 'value', 'title', 'bounds', 'role', 'states'].includes(property))
        throw new TypeError('unsupported get property');
      return ['get', ref(args.ref), '--property', property];
    }
    case 'is': {
      const property = args.property ?? 'visible';
      if (!['visible', 'enabled', 'checked', 'focused', 'expanded', 'selected'].includes(property))
        throw new TypeError('unsupported is property');
      return ['is', ref(args.ref), '--property', property];
    }
    case 'list_surfaces':
      return ['list-surfaces', ...(args.app === undefined ? [] : ['--app', stringArg(args.app, 'app')])];
    case 'click_ref':
      return [...withHeaded('click'), ref(args.ref)];
    case 'type_text': {
      const argv = withHeaded('type');
      const target = ref(args.ref);
      const text = stringArg(args.text, 'text', { max: maxTextLength, allowEmpty: true });
      return [...argv, target, text];
    }
    case 'set_value':
      return ['set-value', ref(args.ref), stringArg(args.value, 'value', { max: maxTextLength, allowEmpty: true })];
    case 'clear':
      return ['clear', ref(args.ref)];
    case 'press_key': {
      const argv = withHeaded('press');
      appendScope(argv, args);
      if (args.app === undefined && args.window_id === undefined)
        throw new TypeError('press_key requires app or window_id to scope the key action');
      return [...argv, stringArg(args.combo, 'combo', { max: 100 })];
    }
    case 'focus_window': {
      const selectors = ['app', 'window_id', 'title'].filter((key) => args[key] !== undefined);
      if (selectors.length !== 1) throw new TypeError('focus_window requires exactly one of app, window_id or title');
      const argv = ['focus-window'];
      if (args.app !== undefined) argv.push('--app', stringArg(args.app, 'app'));
      if (args.window_id !== undefined) argv.push('--window-id', windowId(args.window_id));
      if (args.title !== undefined) argv.push('--title', stringArg(args.title, 'title'));
      return argv;
    }
    case 'wait': {
      const kind = stringArg(args.kind, 'kind', { max: 24 });
      const timeout = args.timeout_ms === undefined ? [] : ['--timeout', integerArg(args.timeout_ms, 'timeout_ms', { min: 1 })];
      const app = args.app === undefined ? [] : ['--app', stringArg(args.app, 'app')];
      switch (kind) {
        case 'time': return ['wait', integerArg(args.milliseconds, 'milliseconds', { max: 300000 })];
        case 'element': {
          const predicate = args.predicate ?? 'exists';
          if (!['exists', 'enabled', 'visible', 'actionable', 'value'].includes(predicate)) throw new TypeError('unsupported element wait predicate');
          const argv = ['wait', '--element', ref(args.ref), '--predicate', predicate, ...timeout, ...app];
          if (args.action !== undefined) {
            if (!['click', 'type', 'set-value', 'clear'].includes(args.action)) throw new TypeError('unsupported wait action');
            argv.push('--action', args.action);
          }
          if (args.value !== undefined) argv.push('--value', stringArg(args.value, 'value', { max: maxTextLength, allowEmpty: true }));
          return argv;
        }
        case 'window': return ['wait', '--window', stringArg(args.title, 'title'), ...timeout, ...app];
        case 'text': {
          const argv = ['wait', '--text', stringArg(args.text, 'text'), ...timeout, ...app];
          if (args.count !== undefined) argv.push('--count', integerArg(args.count, 'count', { min: 1, max: 1000000 }));
          return argv;
        }
        case 'menu': return ['wait', '--menu', ...timeout, ...app];
        case 'menu_closed': return ['wait', '--menu-closed', ...timeout, ...app];
        case 'notification': {
          const argv = ['wait', '--notification', ...timeout];
          if (args.text !== undefined) argv.push('--text', stringArg(args.text, 'text'));
          return argv;
        }
        case 'event': {
          const event = stringArg(args.event, 'event', { max: 32 });
          if (!['window-opened', 'window-closed', 'app-launched', 'app-terminated', 'focus-changed', 'surface-appeared', 'surface-dismissed'].includes(event))
            throw new TypeError('unsupported desktop event');
          const argv = ['wait', '--event', event, ...timeout, ...app];
          if (args.window_id !== undefined) argv.push('--window-id', windowId(args.window_id));
          if (args.title !== undefined) argv.push('--window', stringArg(args.title, 'title'));
          return argv;
        }
        default: throw new TypeError(`unsupported wait kind: ${kind}`);
      }
    }
    case 'desktop_operation':
      return buildExtendedOperation(args);
    default:
      throw new TypeError(`Unknown tool: ${name}`);
  }
}

export function buildInvocation(name, args = {}) {
  const argv = buildCommandInvocation(name, args);
  const supportsWaitFor = new Set(['snapshot', 'click_ref', 'type_text', 'set_value', 'clear', 'press_key']);
  if (name === 'desktop_operation' && ['double_click', 'triple_click', 'right_click', 'focus_ref', 'select', 'toggle', 'check', 'uncheck', 'expand', 'collapse', 'scroll', 'scroll_to', 'hover', 'drag'].includes(args.operation)) supportsWaitFor.add(name);
  if (args.wait_for !== undefined || args.wait_for_gone !== undefined || args.wait_timeout_ms !== undefined || args.wait_for_scope !== undefined) {
    if (!supportsWaitFor.has(name)) throw new TypeError(`${name} does not support post-action wait flags`);
    if (args.wait_for !== undefined && args.wait_for_gone !== undefined) throw new TypeError('wait_for and wait_for_gone cannot be combined');
    if (args.wait_timeout_ms !== undefined && args.wait_for === undefined && args.wait_for_gone === undefined)
      throw new TypeError('wait_timeout_ms requires wait_for or wait_for_gone');
    if (args.wait_for_scope !== undefined && args.wait_for === undefined && args.wait_for_gone === undefined)
      throw new TypeError('wait_for_scope requires wait_for or wait_for_gone');
    if (name === 'snapshot' && args.root !== undefined && (args.wait_for !== undefined || args.wait_for_gone !== undefined))
      throw new TypeError('root cannot be combined with wait_for or wait_for_gone');
    if (args.wait_for !== undefined) argv.push('--wait-for', stringArg(args.wait_for, 'wait_for'));
    if (args.wait_for_gone !== undefined) argv.push('--wait-for-gone', stringArg(args.wait_for_gone, 'wait_for_gone'));
    if (args.wait_timeout_ms !== undefined) argv.push('--wait-timeout', integerArg(args.wait_timeout_ms, 'wait_timeout_ms', { min: 1 }));
    if (args.wait_for_scope !== undefined) {
      if (name !== 'desktop_operation' || args.operation !== 'drag' || !['from', 'to'].includes(args.wait_for_scope))
        throw new TypeError('wait_for_scope is supported only by drag and must be from or to');
      argv.push('--wait-for-scope', args.wait_for_scope);
    }
  }
  const prefix = [];
  if (args.session_id !== undefined) prefix.push('--session', stringArg(args.session_id, 'session_id', { max: 128 }));
  if (args.agent_id !== undefined) {
    const agentId = stringArg(args.agent_id, 'agent_id', { max: 64 });
    if (!/^[A-Za-z0-9_-]+$/.test(agentId)) throw new TypeError('agent_id must use letters, numbers, hyphens, or underscores');
    prefix.push('--agent-id', agentId);
  }
  if (args.trace_path !== undefined) prefix.push('--trace', stringArg(args.trace_path, 'trace_path', { max: 4096 }));
  if (args.trace_strict !== undefined && typeof args.trace_strict !== 'boolean') throw new TypeError('trace_strict must be a boolean');
  if (args.trace_strict === true) prefix.push('--trace-strict');
  return [...prefix, ...argv];
}

export function resolveAgentDesktopBinary(env = process.env, platform = process.platform, arch = process.arch) {
  if (env.AGENT_DESKTOP_BIN) return env.AGENT_DESKTOP_BIN;
  if (platform === 'win32') {
    const archName = arch === 'arm64' ? 'arm64' : 'x64';
    return path.join(
      env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      'npm',
      'node_modules',
      'agent-desktop',
      'bin',
      `agent-desktop-win32-${archName}.exe`,
    );
  }
  return 'agent-desktop';
}

export function runAgentDesktop(name, args = {}, options = {}) {
  const argv = buildInvocation(name, args);
  const binary = options.binary || resolveAgentDesktopBinary(options.env);
  const requestedWait = name === 'wait' && args.kind === 'time' ? args.milliseconds : 0;
  const requestedTimeout = Math.max(args.timeout_ms || 0, args.wait_timeout_ms || 0, requestedWait || 0);
  const baseTimeout = name === 'wait' ? 35000 : 30000;
  const timeoutMs = options.timeoutMs ?? Math.max(baseTimeout, requestedTimeout + 5000);

  return new Promise((resolve, reject) => {
    const child = spawn(binary, argv, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      finish(new Error(`agent-desktop ${argv[0]} timed out after ${timeoutMs} ms`));
    }, timeoutMs);
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(result);
    };
    const append = (current, chunk, stream) => {
      const next = current + chunk.toString('utf8');
      if (Buffer.byteLength(next, 'utf8') > maxOutputBytes) {
        child.kill();
        finish(new Error(`agent-desktop ${argv[0]} output exceeded 1 MiB`));
        return current;
      }
      return next;
    };
    child.stdout.on('data', (chunk) => (stdout = append(stdout, chunk, 'stdout')));
    child.stderr.on('data', (chunk) => (stderr = append(stderr, chunk, 'stderr')));
    child.once('error', (error) => {
      const hint = error.code === 'ENOENT' ? ' Set AGENT_DESKTOP_BIN to the native executable path.' : '';
      finish(new Error(`Could not start agent-desktop: ${error.message}.${hint}`));
    });
    child.once('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        try {
          const envelope = JSON.parse(stdout);
          if (envelope.ok === false) {
            const error = new Error(envelope.error?.message || 'agent-desktop returned an error');
            error.nativeResponse = envelope;
            return finish(error);
          }
        } catch { /* Fall through to the bounded native output message. */ }
        return finish(new Error(stderr.trim() || stdout.trim() || `agent-desktop exited with code ${code}`));
      }
      try {
        const envelope = JSON.parse(stdout);
        if (envelope.ok === false) {
          const error = new Error(envelope.error?.message || 'agent-desktop returned an error');
          error.nativeResponse = envelope;
          return finish(error);
        }
      } catch {
        return finish(new Error(`agent-desktop returned invalid JSON: ${stdout.slice(0, 500)}`));
      }
      finish(null, stdout.trim());
    });
  });
}

const refSchema = { type: 'string', pattern: '^@[A-Za-z0-9_-]+:e\\d+$' };
const windowSchema = { type: 'string', pattern: '^w-\\d+$' };
const surfaceSchema = { type: 'string', enum: [...surfaces] };

export const toolDefinitions = [
  { name: 'desktop_status', description: 'Read agent-desktop version, permissions and supported surfaces.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'list_apps', description: 'List applications visible to the current interactive desktop session, optionally filtered by name.', inputSchema: { type: 'object', properties: { app: { type: 'string' } }, additionalProperties: false } },
  { name: 'list_windows', description: 'List visible windows, optionally filtered by application name.', inputSchema: { type: 'object', properties: { app: { type: 'string' } }, additionalProperties: false } },
  { name: 'list_surfaces', description: 'List currently available accessibility surfaces for an app before reading an open menu or dialog.', inputSchema: { type: 'object', properties: { app: { type: 'string' } }, additionalProperties: false } },
  { name: 'snapshot', description: 'Read an accessibility tree. Use skeleton and root to explore dense apps; choose a surface for an open menu or dialog, and raise timeout_ms for slow Chromium/Electron trees.', inputSchema: { type: 'object', properties: { app: { type: 'string' }, window_id: windowSchema, root: refSchema, surface: surfaceSchema, max_depth: { type: 'integer', minimum: 1, maximum: 128 }, timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 }, skeleton: { type: 'boolean' }, interactive_only: { type: 'boolean' }, compact: { type: 'boolean' }, include_bounds: { type: 'boolean' } }, additionalProperties: false } },
  { name: 'find', description: 'Search an accessibility tree by role, name, value, text, description, native id or state. Scope to an app, window, ref subtree or surface.', inputSchema: { type: 'object', properties: { app: { type: 'string' }, window_id: windowSchema, root: refSchema, surface: surfaceSchema, role: { type: 'string' }, name: { type: 'string' }, value: { type: 'string' }, text: { type: 'string' }, description: { type: 'string' }, native_id: { type: 'string' }, states: { type: 'array', items: { type: 'string' } }, exact: { type: 'boolean' }, count: { type: 'boolean' }, first: { type: 'boolean' }, last: { type: 'boolean' }, nth: { type: 'integer', minimum: 0 }, limit: { type: 'integer', minimum: 0, maximum: 10000 }, timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 } }, additionalProperties: false } },
  { name: 'get', description: 'Read a property from a qualified accessibility ref; use for post-action state checks.', inputSchema: { type: 'object', properties: { ref: refSchema, property: { type: 'string', enum: ['text', 'value', 'title', 'bounds', 'role', 'states'] } }, required: ['ref'], additionalProperties: false } },
  { name: 'is', description: 'Check a boolean state for a qualified accessibility ref.', inputSchema: { type: 'object', properties: { ref: refSchema, property: { type: 'string', enum: ['visible', 'enabled', 'checked', 'focused', 'expanded', 'selected'] } }, required: ['ref'], additionalProperties: false } },
  { name: 'wait', description: 'Wait for an element, window, text, menu, notification or lifecycle event. Prefer this over fixed pauses when a UI transition is expected.', inputSchema: { type: 'object', properties: { kind: { type: 'string', enum: ['time', 'element', 'window', 'text', 'menu', 'menu_closed', 'notification', 'event'] }, milliseconds: { type: 'integer', minimum: 0, maximum: 300000 }, ref: refSchema, predicate: { type: 'string', enum: ['exists', 'enabled', 'visible', 'actionable', 'value'] }, action: { type: 'string', enum: ['click', 'type', 'set-value', 'clear'] }, value: { type: 'string', maxLength: maxTextLength }, title: { type: 'string' }, text: { type: 'string' }, app: { type: 'string' }, window_id: windowSchema, event: { type: 'string', enum: ['window-opened', 'window-closed', 'app-launched', 'app-terminated', 'focus-changed', 'surface-appeared', 'surface-dismissed'] }, count: { type: 'integer', minimum: 1 }, timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 } }, required: ['kind'], additionalProperties: false } },
  { name: 'click_ref', description: 'Click a qualified accessibility ref. Headless semantic click is the default; headed enables physical input and possible focus changes.', inputSchema: { type: 'object', properties: { ref: refSchema, headed: { type: 'boolean', description: 'Opt in to physical input and focus/cursor side effects.' } }, required: ['ref'], additionalProperties: false } },
  { name: 'type_text', description: 'Type into a text target. On Windows this requires headed=true; prefer set_value for headless text-field writes. Use physical input only when the task authorizes it; never switch to headed mode to recover from a headless failure.', inputSchema: { type: 'object', properties: { ref: refSchema, text: { type: 'string', maxLength: maxTextLength }, headed: { type: 'boolean', description: 'Required on Windows; opts into physical keyboard input and focus side effects.' } }, required: ['ref', 'text'], additionalProperties: false } },
  { name: 'set_value', description: 'Set a text field or slider value through the accessibility value path. It is usually headless, but verify the app accepted the value.', inputSchema: { type: 'object', properties: { ref: refSchema, value: { type: 'string', maxLength: maxTextLength } }, required: ['ref', 'value'], additionalProperties: false } },
  { name: 'clear', description: 'Clear a text target by qualified accessibility ref.', inputSchema: { type: 'object', properties: { ref: refSchema }, required: ['ref'], additionalProperties: false } },
  { name: 'press_key', description: 'Send a key combo. Requires app or window_id as a target check; on Windows keys go to the foreground queue and do not switch focus. Dangerous shortcuts remain blocked.', inputSchema: { type: 'object', properties: { combo: { type: 'string', description: 'agent-desktop key combo such as return or ctrl+l.' }, app: { type: 'string' }, window_id: windowSchema, headed: { type: 'boolean', description: 'Allow headed focus/cursor side effects when the platform requires them.' } }, required: ['combo'], additionalProperties: false } },
  { name: 'focus_window', description: 'Bring one window to the foreground and confirm OS focus. This interrupts the current foreground app.', inputSchema: { type: 'object', properties: { app: { type: 'string' }, window_id: windowSchema, title: { type: 'string' } }, additionalProperties: false } },
  { name: 'desktop_operation', description: 'Run one additional fixed agent-desktop operation. Supports screenshots and displays, semantic controls, headed pointer gestures, window lifecycle/layout, notifications, clipboard, permissions, sessions, traces, cursor overlay, and bundled docs. Each operation accepts only the relevant fields; screenshot results may include an image.', inputSchema: { type: 'object', properties: {
    operation: { type: 'string', enum: ['screenshot', 'list_displays', 'open_system_surface', 'double_click', 'triple_click', 'right_click', 'focus_ref', 'select', 'toggle', 'check', 'uncheck', 'expand', 'collapse', 'scroll', 'scroll_to', 'hover', 'drag', 'mouse_move', 'mouse_click', 'mouse_wheel', 'launch_app', 'close_app', 'resize_window', 'move_window', 'minimize', 'maximize', 'restore', 'list_notifications', 'dismiss_notification', 'dismiss_all_notifications', 'notification_action', 'clipboard_get', 'clipboard_set', 'clipboard_clear', 'permissions', 'version', 'session_start', 'session_end', 'session_list', 'session_gc', 'trace_show', 'trace_export', 'cursor_overlay_enable', 'cursor_overlay_disable', 'desktop_docs', 'batch'] },
    app: { type: 'string' }, window_id: windowSchema, ref: refSchema, screen: { type: 'integer', minimum: 0, maximum: 64 }, surface: { type: 'string', enum: ['start-menu', 'taskbar', 'system-tray', 'system-tray-overflow', 'action-center'] },
    headed: { type: 'boolean', description: 'Required for physical gestures, shell surface opening, and notification mutations; opts into foreground/cursor effects.' }, timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 }, value: { type: 'string', maxLength: maxTextLength }, direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] }, amount: { type: 'integer', minimum: 1, maximum: 1000 },
    point: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false }, from_ref: refSchema, from_point: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false }, to_ref: refSchema, to_point: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false }, duration_ms: { type: 'integer', minimum: 0, maximum: 60000 }, drop_delay_ms: { type: 'integer', minimum: 0, maximum: 10000 }, wait_for: { type: 'string' }, wait_for_gone: { type: 'string' }, wait_timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 }, wait_for_scope: { type: 'string', enum: ['from', 'to'] },
    x: { type: 'integer' }, y: { type: 'integer' }, dx: { type: 'integer' }, dy: { type: 'integer' }, button: { type: 'string', enum: ['left', 'right', 'middle'] }, count: { type: 'integer', minimum: 1, maximum: 10 }, modifiers: { type: 'array', items: { type: 'string', enum: ['shift', 'meta', 'ctrl', 'alt', 'cmd'] } },
    args: { type: 'array', items: { type: 'string', maxLength: 2048 }, maxItems: 20 }, env: { type: 'array', items: { type: 'string', maxLength: 4096 }, maxItems: 20 }, cwd: { type: 'string', maxLength: 4096 }, activate: { type: 'boolean' }, no_attach: { type: 'boolean' }, cdp: { type: 'boolean' }, cdp_port: { type: 'integer', minimum: 0, maximum: 65535 }, force: { type: 'boolean', description: 'Force terminates processes instead of gracefully quitting; may lose unsaved work.' }, width: { type: 'integer', minimum: 1, maximum: 20000 }, height: { type: 'integer', minimum: 1, maximum: 20000 },
    text: { type: 'string', maxLength: maxTextLength }, limit: { type: 'integer', minimum: 0, maximum: 100000 }, index: { type: 'integer', minimum: 1 }, action: { type: 'string' }, expected_app: { type: 'string' }, expected_title: { type: 'string' }, format: { type: 'string', enum: ['text', 'auto', 'image', 'file-urls'] }, image_path: { type: 'string', maxLength: 4096 }, file_urls: { type: 'array', items: { type: 'string', maxLength: 4096 }, maxItems: 20 }, request: { type: 'boolean', description: 'Ask the operating system to request missing permissions.' }, guide: { type: 'boolean', description: 'Open a macOS permission guide when supported.' },
    name: { type: 'string', maxLength: 128 }, no_trace: { type: 'boolean' }, screenshots: { type: 'boolean', description: 'Record sensitive before/after screenshots in the session trace.' }, cursor: { type: 'boolean' }, multi_agent: { type: 'boolean' }, target_session_id: { type: 'string', maxLength: 128 }, ended_only: { type: 'boolean' }, older_than_seconds: { type: 'integer', minimum: 0, maximum: 315360000 }, event_prefix: { type: 'string', maxLength: 100 }, output_path: { type: 'string', maxLength: 4096 }, label: { type: 'string', maxLength: 120 }, fill: { type: 'string', maxLength: 16 }, rim: { type: 'string', maxLength: 16 }, accent: { type: 'string', maxLength: 16 }, size: { type: 'number', minimum: 0.5, maximum: 4 }, max_words: { type: 'integer', minimum: 1, maximum: 12 }, image_path: { type: 'string', maxLength: 4096 }, pointer_image_path: { type: 'string', maxLength: 4096 }, hotspot: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false }, pointer_hotspot: { type: 'object', properties: { x: { type: 'integer' }, y: { type: 'integer' } }, required: ['x', 'y'], additionalProperties: false }, travel_min_ms: { type: 'integer', minimum: 30, maximum: 10000 }, travel_max_ms: { type: 'integer', minimum: 30, maximum: 10000 }, bow: { type: 'number', minimum: 0, maximum: 3 }, overshoot: { type: 'number', minimum: 0, maximum: 0.15 }, tremor: { type: 'number', minimum: 0, maximum: 4 }, dwell_ms: { type: 'integer', minimum: 0, maximum: 300 }, motion_seed: { type: 'integer', minimum: 0, maximum: 2147483647 }, no_ripple: { type: 'boolean' }, no_highlight: { type: 'boolean' }, skill: { type: 'string', enum: ['desktop', 'platform', 'list', 'path'] }, reference: { type: 'string', maxLength: 200 }, steps: { type: 'array', minItems: 1, maxItems: 30, items: { type: 'object', properties: { command: { type: 'string', enum: ['snapshot', 'find', 'get', 'is', 'click', 'double-click', 'triple-click', 'right-click', 'type', 'set-value', 'clear', 'select', 'toggle', 'check', 'uncheck', 'expand', 'collapse', 'scroll-to', 'scroll', 'press', 'wait'] }, args: { type: 'object' } }, required: ['command', 'args'], additionalProperties: false } }, stop_on_error: { type: 'boolean', description: 'Stop at the first failed step. Defaults to true for safety.' }
  }, required: ['operation'], additionalProperties: false } },
];

const sharedContextSchema = {
  session_id: { type: 'string', maxLength: 128, description: 'Optional agent-desktop session scope. Use the ID returned by session_start.' },
  agent_id: { type: 'string', pattern: '^[A-Za-z0-9_-]{1,64}$', description: 'Harness subagent ID for isolated cursors in a multi-agent session.' },
  trace_path: { type: 'string', maxLength: 4096, description: 'Optional JSONL trace destination. This appends to the selected file.' },
  trace_strict: { type: 'boolean', description: 'Fail the command when trace setup or pre-action trace writes fail.' },
};
for (const definition of toolDefinitions) {
  definition.inputSchema.properties = { ...definition.inputSchema.properties, ...sharedContextSchema };
}
const postActionWaitSchema = {
  wait_for: { type: 'string', description: 'After an action, wait for a role:text selector to appear in the acted-on window.' },
  wait_for_gone: { type: 'string', description: 'After an action, wait for a role:text selector to disappear from the acted-on window.' },
  wait_timeout_ms: { type: 'integer', minimum: 1, maximum: 300000 },
};
for (const definition of toolDefinitions) {
  if (['snapshot', 'click_ref', 'type_text', 'set_value', 'clear', 'press_key'].includes(definition.name)) {
    definition.inputSchema.properties = { ...definition.inputSchema.properties, ...postActionWaitSchema };
  }
}

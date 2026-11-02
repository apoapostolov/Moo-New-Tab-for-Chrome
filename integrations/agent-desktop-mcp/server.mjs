#!/usr/bin/env node
import { createInterface } from 'node:readline';
import { readFile, realpath, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runAgentDesktop, toolDefinitions } from './bridge.mjs';

const protocolVersion = '2025-06-18';
const input = createInterface({ input: process.stdin, crlfDelay: Infinity });

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function failure(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function extractPng(value) {
  if (typeof value === 'string' && value.length <= 14 * 1024 * 1024) {
    const candidate = Buffer.from(value, 'base64');
    if (candidate.length <= 10 * 1024 * 1024 && isPng(candidate)) return candidate;
    return undefined;
  }
  if (!value || typeof value !== 'object') return undefined;
  for (const [key, child] of Object.entries(value)) {
    const found = extractPng(child);
    if (found) {
      value[key] = '[PNG returned as image content]';
      return found;
    }
  }
  return undefined;
}

function isExtendedOperation(name, args, expected) {
  return name === 'desktop_operation' && args.operation === expected;
}

async function toolContent(name, args, raw) {
  const envelope = JSON.parse(raw);
  const blocks = [];
  let png;
  try {
    if (isExtendedOperation(name, args, 'screenshot')) {
      png = extractPng(envelope.data);
      if (png && typeof envelope.data === 'string') envelope.data = '[PNG returned as image content]';
    } else if (isExtendedOperation(name, args, 'clipboard_get') && envelope.data?.type === 'image' && typeof envelope.data.path === 'string') {
      const stateRoot = path.resolve(process.env.AGENT_DESKTOP_HOME || path.join(os.homedir(), '.agent-desktop'));
      const imagePath = await realpath(envelope.data.path);
      const relative = path.relative(stateRoot, imagePath);
      if (relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)) {
        const imageInfo = await stat(imagePath);
        if (imageInfo.size <= 10 * 1024 * 1024) png = await readFile(imagePath);
      }
    }
  } catch { /* Keep the native JSON result when an optional image artifact cannot be read. */ }
  if (png && png.length <= 10 * 1024 * 1024 && isPng(png)) {
    if (envelope.data && typeof envelope.data === 'object') {
      delete envelope.data.base64;
      delete envelope.data.png_base64;
      delete envelope.data.image_base64;
    }
    blocks.push({ type: 'text', text: JSON.stringify(envelope) });
    blocks.push({ type: 'image', data: png.toString('base64'), mimeType: 'image/png' });
  } else {
    blocks.push({ type: 'text', text: raw });
  }
  return blocks;
}

async function handle(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    if (message?.id !== undefined) failure(message.id, -32600, 'Invalid JSON-RPC request');
    return;
  }
  if (message.method.startsWith('notifications/')) return;
  const id = message.id;
  if (id === undefined) return;
  try {
    if (message.method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: message.params?.protocolVersion || protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'agent-desktop-mcp', version: '0.2.0' },
        },
      });
      return;
    }
    if (message.method === 'ping') {
      send({ jsonrpc: '2.0', id, result: {} });
      return;
    }
    if (message.method === 'tools/list') {
      send({ jsonrpc: '2.0', id, result: { tools: toolDefinitions } });
      return;
    }
    if (message.method === 'tools/call') {
      const { name, arguments: args = {} } = message.params || {};
      const text = await runAgentDesktop(name, args);
      send({ jsonrpc: '2.0', id, result: { content: await toolContent(name, args, text), isError: false } });
      return;
    }
    failure(id, -32601, `Method not found: ${message.method}`);
  } catch (error) {
    if (message.method === 'tools/call') {
      const text = error.nativeResponse ? JSON.stringify(error.nativeResponse) : String(error.message || error);
      send({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text }], isError: true } });
    } else {
      failure(id, -32602, String(error.message || error));
    }
  }
}

input.on('line', (line) => {
  if (!line.trim()) return;
  try {
    void handle(JSON.parse(line));
  } catch {
    failure(null, -32700, 'Parse error');
  }
});

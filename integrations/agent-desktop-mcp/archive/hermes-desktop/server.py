#!/usr/bin/env python3
"""Small stdio MCP adapter for Vercel agent-desktop. No shell or arbitrary command tool."""

import json
import os
import re
import shutil
import subprocess
import sys

PROTOCOL_VERSION = "2025-06-18"
MAX_TEXT = 10_000
MAX_OUTPUT = 1_048_576
REF = re.compile(r"^@[A-Za-z0-9_-]+:e\d+$")
WINDOW = re.compile(r"^w-\d+$")


def string_arg(value, label, maximum=512, allow_empty=False):
    if not isinstance(value, str) or (not allow_empty and not value.strip()) or len(value) > maximum or "\0" in value:
        raise ValueError(f"{label} must be a {'string' if allow_empty else 'non-empty string'} of at most {maximum} characters")
    return value


def build_invocation(name, args):
    if not isinstance(args, dict):
        raise ValueError("tool arguments must be an object")
    if name == "desktop_status":
        return ["status"]
    if name == "list_apps":
        return ["list-apps"]
    if name == "list_windows":
        result = ["list-windows"]
        if "app" in args:
            result += ["--app", string_arg(args["app"], "app")]
        return result
    if name == "snapshot":
        result = ["snapshot"]
        if "app" in args:
            result += ["--app", string_arg(args["app"], "app")]
        if "window_id" in args:
            wid = string_arg(args["window_id"], "window_id", 64)
            if not WINDOW.fullmatch(wid):
                raise ValueError("window_id must come from agent-desktop list-windows")
            result += ["--window-id", wid]
        if "max_depth" in args:
            depth = args["max_depth"]
            if isinstance(depth, bool) or not isinstance(depth, int) or not 1 <= depth <= 20:
                raise ValueError("max_depth must be an integer from 1 to 20")
            result += ["--max-depth", str(depth)]
        if args.get("interactive_only") is True:
            result.append("--interactive-only")
        if args.get("compact") is True:
            result.append("--compact")
        return result
    if name in ("click_ref", "type_text"):
        target = string_arg(args.get("ref"), "ref", 128)
        if not REF.fullmatch(target):
            raise ValueError("ref must be a qualified ref from the latest agent-desktop snapshot")
        if name == "click_ref":
            return ["click", target]
        text = string_arg(args.get("text"), "text", MAX_TEXT, allow_empty=True)
        return ["type", target, text]
    if name == "press_key":
        combo = string_arg(args.get("combo"), "combo", 100)
        result = ["press"]
        if "app" in args:
            result += ["--app", string_arg(args["app"], "app")]
        if "window_id" in args:
            wid = string_arg(args["window_id"], "window_id", 64)
            if not WINDOW.fullmatch(wid):
                raise ValueError("window_id must come from agent-desktop list-windows")
            result += ["--window-id", wid]
        if "app" not in args and "window_id" not in args:
            raise ValueError("press_key requires app or window_id to scope the key action")
        return result + [combo]
    if name == "focus_window":
        selectors = [key for key in ("app", "window_id", "title") if key in args]
        if len(selectors) != 1:
            raise ValueError("focus_window requires exactly one of app, window_id or title")
        key = selectors[0]
        value = string_arg(args[key], key, 64 if key == "window_id" else 512)
        if key == "window_id" and not WINDOW.fullmatch(value):
            raise ValueError("window_id must come from agent-desktop list-windows")
        flag = {"app": "--app", "window_id": "--window-id", "title": "--title"}[key]
        return ["focus-window", flag, value]
    raise ValueError(f"Unknown tool: {name}")


def resolve_binary():
    configured = os.environ.get("AGENT_DESKTOP_BIN")
    if configured:
        return configured
    if os.name == "nt":
        appdata = os.environ.get("APPDATA", os.path.expanduser(r"~\AppData\Roaming"))
        arch = "arm64" if os.environ.get("PROCESSOR_ARCHITECTURE", "").lower() == "arm64" else "x64"
        return os.path.join(appdata, "npm", "node_modules", "agent-desktop", "bin", f"agent-desktop-win32-{arch}.exe")
    return shutil.which("agent-desktop") or "agent-desktop"


def run_agent_desktop(name, args):
    argv = build_invocation(name, args)
    try:
        completed = subprocess.run([resolve_binary(), *argv], capture_output=True, text=True, timeout=30, check=False)
    except FileNotFoundError as exc:
        raise RuntimeError(f"Could not start agent-desktop: {exc}. Set AGENT_DESKTOP_BIN to its native executable path.") from exc
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"agent-desktop {argv[0]} timed out after 30 seconds") from exc
    stdout, stderr = completed.stdout or "", completed.stderr or ""
    if len(stdout.encode("utf-8", errors="replace")) + len(stderr.encode("utf-8", errors="replace")) > MAX_OUTPUT:
        raise RuntimeError("agent-desktop output exceeded 1 MiB")
    if completed.returncode != 0:
        raise RuntimeError(stderr.strip() or stdout.strip() or f"agent-desktop exited with code {completed.returncode}")
    try:
        envelope = json.loads(stdout)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"agent-desktop returned invalid JSON: {stdout[:500]}") from exc
    if isinstance(envelope, dict) and envelope.get("ok") is False:
        raise RuntimeError(envelope.get("error", {}).get("message", "agent-desktop returned an error"))
    return stdout.strip()


TOOLS = [
    {"name": "desktop_status", "description": "Read agent-desktop version, permissions and supported surfaces.", "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "list_apps", "description": "List applications visible to the current interactive desktop session.", "inputSchema": {"type": "object", "properties": {}, "additionalProperties": False}},
    {"name": "list_windows", "description": "List accessible desktop windows, optionally filtered by application name.", "inputSchema": {"type": "object", "properties": {"app": {"type": "string"}}, "additionalProperties": False}},
    {"name": "snapshot", "description": "Read an app accessibility tree. Re-snapshot after UI changes before using refs.", "inputSchema": {"type": "object", "properties": {"app": {"type": "string"}, "window_id": {"type": "string", "pattern": "^w-\\d+$"}, "max_depth": {"type": "integer", "minimum": 1, "maximum": 20}, "interactive_only": {"type": "boolean"}, "compact": {"type": "boolean"}}, "additionalProperties": False}},
    {"name": "click_ref", "description": "Click a qualified accessibility ref from the latest snapshot.", "inputSchema": {"type": "object", "properties": {"ref": {"type": "string", "pattern": "^@[A-Za-z0-9_-]+:e\\d+$"}}, "required": ["ref"], "additionalProperties": False}},
    {"name": "type_text", "description": "Type text into a text target selected by a recent snapshot ref.", "inputSchema": {"type": "object", "properties": {"ref": {"type": "string", "pattern": "^@[A-Za-z0-9_-]+:e\\d+$"}, "text": {"type": "string", "maxLength": MAX_TEXT}}, "required": ["ref", "text"], "additionalProperties": False}},
    {"name": "press_key", "description": "Send a key combo to a named app or window. Requires an explicit target.", "inputSchema": {"type": "object", "properties": {"combo": {"type": "string"}, "app": {"type": "string"}, "window_id": {"type": "string", "pattern": "^w-\\d+$"}}, "required": ["combo"], "additionalProperties": False}},
    {"name": "focus_window", "description": "Focus one window selected by app name, window ID or title.", "inputSchema": {"type": "object", "properties": {"app": {"type": "string"}, "window_id": {"type": "string", "pattern": "^w-\\d+$"}, "title": {"type": "string"}}, "additionalProperties": False}},
]


def send(payload):
    sys.stdout.write(json.dumps(payload, separators=(",", ":")) + "\n")
    sys.stdout.flush()


def handle(request):
    if not isinstance(request, dict) or request.get("jsonrpc") != "2.0" or not isinstance(request.get("method"), str):
        if isinstance(request, dict) and "id" in request:
            send({"jsonrpc": "2.0", "id": request.get("id"), "error": {"code": -32600, "message": "Invalid JSON-RPC request"}})
        return
    method, rid = request["method"], request.get("id")
    if method.startswith("notifications/") or rid is None:
        return
    try:
        if method == "initialize":
            result = {"protocolVersion": request.get("params", {}).get("protocolVersion", PROTOCOL_VERSION), "capabilities": {"tools": {"listChanged": False}}, "serverInfo": {"name": "agent-desktop-mcp", "version": "0.1.0"}}
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": TOOLS}
        elif method == "tools/call":
            params = request.get("params") or {}
            try:
                output = run_agent_desktop(params.get("name"), params.get("arguments") or {})
                result = {"content": [{"type": "text", "text": output}], "isError": False}
            except Exception as exc:
                result = {"content": [{"type": "text", "text": str(exc)}], "isError": True}
        else:
            send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32601, "message": f"Method not found: {method}"}})
            return
        send({"jsonrpc": "2.0", "id": rid, "result": result})
    except Exception as exc:
        send({"jsonrpc": "2.0", "id": rid, "error": {"code": -32602, "message": str(exc)}})


def main():
    for line in sys.stdin:
        if line.strip():
            try:
                handle(json.loads(line))
            except json.JSONDecodeError:
                send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})


if __name__ == "__main__":
    main()

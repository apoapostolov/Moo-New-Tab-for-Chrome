# Agent Desktop for Hermes

This is a Hermes plugin package for Vercel `agent-desktop`. It includes a portable Agent Plugins v1 manifest and stdio MCP server, a Hermes Desktop pane, an Agent Skill and an SVG icon.

The MCP server exposes a fixed set of desktop operations: status, app and window discovery, accessibility snapshots, ref-based clicks and typing, scoped key presses and window focus. It does not expose arbitrary shell execution, app launch or app close.

## Install in Hermes Desktop

Install the repository or this subdirectory from Hermes Desktop's plugin installer, then enable **Agent Desktop** in Settings > Plugins. The desktop UI half is opt-in. If installing by repository URL, use the repository URL with `integrations/agent-desktop-mcp` as the package subdirectory when the installer supports subdirectories.

The package must be committed and available to the installer. Hermes clones Git sources, so uncommitted local files are not included. The standalone Hermes CLI supports portable packages with:

```powershell
hermes plugins install <owner>/<repository>/integrations/agent-desktop-mcp --no-enable
hermes plugins enable agent-desktop-mcp
```

## Requirements

- Hermes with portable Agent Plugins v1 and desktop plugin installation support
- Python available as `python` to the Hermes MCP process
- Vercel `agent-desktop` installed for the current user
- An interactive desktop session and the operating system permissions required by `agent-desktop`

On Windows the server looks for the npm-installed native executable under `%APPDATA%\npm\node_modules\agent-desktop\bin`. Set `AGENT_DESKTOP_BIN` in the MCP server environment when the executable is installed elsewhere. On macOS and Linux, it uses `agent-desktop` from `PATH`.

## Test locally

```powershell
python -m py_compile .\server.py
npm test
```

The stdio server can be run directly with `python server.py`. MCP messages use one JSON-RPC object per line.

## Tool use

1. Call `desktop_status` to check version and permissions.
2. Use `list_apps` and `list_windows` to find the target.
3. Take a fresh `snapshot` before clicking or typing. Snapshot refs are short-lived.
4. Scope key presses to an app or window. Focus exactly one app, window ID or title.

Tool output may contain window titles or application content. Treat it as sensitive and untrusted.

## Files

- `plugin.json`, `mcp.json`: portable Hermes agent plugin metadata and MCP declaration
- `server.py`: dependency-free stdio MCP server
- `desktop/plugin.js`: Hermes Desktop pane, opt-in by default
- `skills/agent-desktop/SKILL.md`: usage instructions for the Hermes agent
- `icon.svg`: source icon
- `server.mjs`, `bridge.mjs`: optional Node.js MCP runner for other MCP clients

import { jsx, jsxs } from 'react/jsx-runtime'

const ID = 'agent-desktop-mcp'

function AgentDesktopPane() {
  return jsxs('div', {
    className: 'flex h-full flex-col gap-3 p-4 text-sm',
    children: [
      jsxs('div', {
        className: 'flex items-center gap-3',
        children: [
          jsx('div', {
            className: 'flex h-9 w-9 items-center justify-center rounded-lg bg-(--chrome-action-hover)',
            'aria-hidden': true,
            children: jsx('svg', {
              viewBox: '0 0 48 48',
              className: 'h-7 w-7',
              fill: 'none',
              children: jsxs('g', {
                stroke: 'currentColor',
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 2.5,
                children: [
                  jsx('rect', { x: 7, y: 8, width: 34, height: 27, rx: 5 }),
                  jsx('path', { d: 'M17 41h14M24 35v6M15 17h9M15 23h13M15 29h7' }),
                  jsx('circle', { cx: 34, cy: 24, r: 2, fill: 'currentColor', stroke: 'none' })
                ]
              })
            })
          }),
          jsxs('div', {
            children: [
              jsx('div', { className: 'font-medium', children: 'Agent Desktop' }),
              jsx('div', { className: 'text-(--ui-text-tertiary)', children: 'Vercel desktop automation tools' })
            ]
          })
        ]
      }),
      jsx('p', {
        className: 'text-(--ui-text-secondary)',
        children: 'The agent-side MCP tools provide desktop status, app and window discovery, accessibility snapshots, ref-based clicks and typing, scoped key presses and window focus.'
      }),
      jsx('p', {
        className: 'text-(--ui-text-tertiary)',
        children: 'Enable this plugin in Settings > Plugins. Install Vercel agent-desktop separately and grant its required operating system permissions.'
      })
    ]
  })
}

export default {
  id: ID,
  name: 'Agent Desktop',
  defaultEnabled: false,
  register(ctx) {
    ctx.register({
      id: 'overview',
      area: 'panes',
      title: 'agent desktop',
      data: { placement: 'right', width: '300px' },
      render: () => jsx(AgentDesktopPane, {})
    })
  }
}

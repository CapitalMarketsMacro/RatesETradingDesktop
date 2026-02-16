import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export function registerOpenFinGuideResource(server: McpServer): void {
  server.resource(
    'openfin',
    'rates://openfin',
    {
      description: 'OpenFin 4-mode guide — Browser, Platform, Container, and Web deployment modes',
      mimeType: 'text/markdown',
    },
    async () => {
      const content = `# OpenFin Integration Guide

## Overview

The Rates E-Trading Desktop runs on OpenFin, which provides multi-window layout management,
inter-application communication, and native desktop integration. The app supports 4 deployment
modes, each with different capabilities.

## Deployment Modes

### 1. Browser Mode
- **When**: Running \`nx serve rates-desktop\` and opening in Chrome/Edge
- **Features**: Single-window SPA, router-based navigation, no OpenFin APIs
- **Layout**: PrimeNG Menubar for navigation, single-view at a time
- **Use case**: Local development and debugging without OpenFin runtime
- **Detection**: \`OpenFinService.environment === 'browser'\`

### 2. Platform Mode (Full Desktop)
- **When**: Launched via OpenFin Platform manifest
- **Features**: Full multi-window layout, drag-and-drop tab management, layout save/restore,
  inter-app messaging via OpenFin channels
- **Layout**: Each component runs as an OpenFin View inside Platform Windows. Users can
  drag views between windows, snap windows, and save/restore named layouts
- **Use case**: Production deployment on trader desktops
- **Detection**: \`OpenFinService.environment === 'platform'\`
- **Key APIs**: \`Platform.Layout\`, \`Platform.createView()\`, \`Platform.getSnapshot()\`

### 3. Container Mode
- **When**: Launched via OpenFin Container configuration
- **Features**: Single window with embedded views, simpler than Platform but still multi-view
- **Layout**: Container manages child windows. More lightweight than Platform
- **Use case**: Simplified deployment where full Platform features aren't needed
- **Detection**: \`OpenFinService.environment === 'container'\`

### 4. Web Mode (core-web)
- **When**: Using \`@openfin/core-web\` in a standard browser
- **Features**: Layout management within a single browser tab using OpenFin's web layout engine.
  Provides Platform-like layout features without the OpenFin runtime
- **Layout**: Multi-panel layout within a single browser window, similar to VS Code panels
- **Use case**: Browser-first deployment with layout management
- **Detection**: \`OpenFinService.environment === 'web'\`

## OpenFinService

Located at \`libs/openfin/src/lib/openfin.service.ts\`, the \`OpenFinService\` handles:

1. **Environment detection** — Determines which mode the app is running in
2. **View creation** — \`addViewFromMenu(baseName, url)\` creates views appropriate for the mode
3. **Layout management** — Save/restore/delete named layouts (Platform mode)
4. **Connection status** — Observable \`connectionStatus$\` for UI binding
5. **Window management** — Create/close windows, manage window positions

## Adding a New Component as an OpenFin View

When adding a new component that should appear as its own view:

1. Create the component extending \`WorkspaceComponent\`
2. Register a route in \`app.routes.ts\`
3. Add a menu item in \`app.ts\` that calls \`addViewFromMenu(baseName, routePath)\`
4. The \`addViewFromMenu\` method handles all 4 modes:
   - **Browser**: Navigates via Angular Router
   - **Platform**: Creates a new OpenFin View with the route URL
   - **Container**: Creates a child window
   - **Web**: Creates a panel in the core-web layout

## Layout Persistence

- Layouts are saved/restored via \`localStorage\` (browser) or OpenFin APIs (platform)
- Each layout has a user-defined name
- Auto-restore: The last active layout is restored on app startup
- Grid state (columns, sort, filter) is persisted per-component via \`WorkspaceComponent\`

## Testing in Each Mode

| Mode | How to Test | Notes |
|------|------------|-------|
| Browser | \`nx serve rates-desktop\` → open http://localhost:4200 | Fastest iteration cycle |
| Platform | Launch OpenFin manifest → platform auto-starts | Requires OpenFin runtime |
| Container | Launch OpenFin container config | Requires OpenFin runtime |
| Web | \`nx serve rates-desktop\` with core-web initialization | Browser-only, no runtime needed |
`;

      return { contents: [{ uri: 'rates://openfin', text: content, mimeType: 'text/markdown' }] };
    },
  );
}

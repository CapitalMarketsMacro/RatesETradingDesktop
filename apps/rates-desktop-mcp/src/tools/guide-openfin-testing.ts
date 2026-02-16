import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

const MODES = ['browser', 'platform', 'container', 'web'] as const;

export function registerGuideOpenFinTesting(server: McpServer): void {
  server.tool(
    'guide_openfin_testing',
    'Guide for testing the application in different OpenFin modes (Browser, Platform, Container, Web).',
    {
      mode: z
        .enum(MODES)
        .optional()
        .describe('Specific mode to get testing guide for. Omit for all modes.'),
    },
    async ({ mode }) => {
      const sections: string[] = ['# OpenFin Testing Guide', ''];

      const modeGuides: Record<string, string> = {
        browser: `## Browser Mode

**Best for**: Daily development, debugging, rapid iteration

### Setup
\`\`\`bash
nx serve rates-desktop
\`\`\`

### Access
Open http://localhost:4200 in Chrome or Edge.

### Behavior
- Single-window SPA with Angular Router navigation
- Menu items navigate via router (no new windows)
- OpenFinService reports \`environment === 'browser'\`
- Layout save/restore uses localStorage only
- No inter-app communication

### Testing Checklist
- [ ] All routes load correctly
- [ ] Menu navigation works
- [ ] Grid data loads (requires AMPS connection)
- [ ] State persistence works (resize columns, refresh page)
- [ ] Theme toggle (dark/light) works
- [ ] Status bar shows connection status

### Debugging Tips
- Use Chrome DevTools for Angular debugging
- Install Angular DevTools extension
- Check Console for AMPS connection errors
- Network tab shows WebSocket frames for AMPS messages`,

        platform: `## Platform Mode (Full Desktop)

**Best for**: Production-like testing, multi-window layout, inter-app communication

### Setup
1. Install OpenFin runtime (if not already)
2. Build the app: \`nx build rates-desktop\`
3. Launch via OpenFin manifest

### Behavior
- Full multi-window layout management
- Menu items create new OpenFin Views
- Drag-and-drop tab management between windows
- Layout save/restore via OpenFin APIs
- Inter-application messaging via OpenFin channels

### Testing Checklist
- [ ] App launches in OpenFin Platform
- [ ] Menu creates new view windows
- [ ] Views can be dragged between windows
- [ ] Layout save and restore works
- [ ] Each view instance has independent state
- [ ] Multiple instances of same component work (?viewId=xxx)
- [ ] Window snapping and docking works
- [ ] Status bar shows OpenFin connection status

### Debugging Tips
- Use OpenFin DevTools: right-click view → Inspect
- Check OpenFin logs: %LOCALAPPDATA%/OpenFin/
- Verify manifest URLs match build output
- Test layout persistence after restart`,

        container: `## Container Mode

**Best for**: Simplified multi-window testing without full Platform complexity

### Setup
1. Build the app: \`nx build rates-desktop\`
2. Launch via OpenFin Container configuration

### Behavior
- Single main window with child windows
- Simpler than Platform mode
- Container manages window lifecycle
- Less layout flexibility than Platform

### Testing Checklist
- [ ] App launches in OpenFin Container
- [ ] Child windows open from menu
- [ ] Child windows close properly
- [ ] State persists across child windows
- [ ] Connection status reflects in all windows

### Debugging Tips
- Similar to Platform debugging
- Check Container logs
- Verify window creation/destruction lifecycle`,

        web: `## Web Mode (core-web)

**Best for**: Browser deployment with layout management, no OpenFin runtime required

### Setup
\`\`\`bash
nx serve rates-desktop
\`\`\`
The app detects core-web initialization and enters web mode.

### Behavior
- Multi-panel layout within a single browser window
- Similar to VS Code panel layout
- OpenFin core-web manages panel positioning
- No native window management (all in one browser tab)
- Layout save/restore via core-web APIs

### Testing Checklist
- [ ] Layout panels render correctly
- [ ] Panels can be resized
- [ ] Menu creates new panels (not windows)
- [ ] Panel state persists
- [ ] Works in Chrome, Edge, Firefox
- [ ] Core-web initialization succeeds

### Debugging Tips
- Use browser DevTools
- Check core-web console logs
- Verify @openfin/core-web is loaded
- Test panel creation/destruction`,
      };

      if (mode) {
        sections.push(modeGuides[mode]);
      } else {
        for (const m of MODES) {
          sections.push(modeGuides[m]);
          sections.push('');
        }

        sections.push(
          '## Mode Comparison',
          '',
          '| Feature | Browser | Platform | Container | Web |',
          '|---------|---------|----------|-----------|-----|',
          '| Multi-window | No | Yes | Yes | No (panels) |',
          '| Layout management | No | Full | Basic | Panels |',
          '| OpenFin runtime | No | Yes | Yes | No |',
          '| Dev speed | Fastest | Slower | Medium | Fast |',
          '| Production-like | No | Yes | Partial | Partial |',
          '| Inter-app comms | No | Yes | Limited | No |',
        );
      }

      return { content: [{ type: 'text' as const, text: sections.join('\n') }] };
    },
  );
}

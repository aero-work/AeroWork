# Implementation TODOs

Date: 2026-01-15
Updated: 2026-01-15

## Completed Tasks

### 1. Project Folder Browser Enhancement
**Status:** Completed
**Priority:** High

**Description:**
Enhanced the project selector with a "Browse" tab that allows:
- Navigate directories like a file explorer
- Go up to parent directory
- Enter child directories
- Select any folder as project root

**Files modified:**
- `src/components/common/ProjectSelector.tsx` - Added Browse tab with directory navigation

---

### 2. Settings Page Feature Verification
**Status:** Completed
**Priority:** Medium

**Description:**
Verified and fixed all settings page features:
- Hidden files toggle - Fixed to use settingsStore (was duplicated in fileStore)
- Auto-connect on startup - Fixed useAutoConnect hook to respect setting
- Auto-clean empty sessions - Already working
- Theme switching - Already working

**Files modified:**
- `src/hooks/useAutoConnect.ts` - Added autoConnect setting check
- `src/components/editor/FileTree.tsx` - Changed to use settingsStore.showHiddenFiles
- `src/components/layout/Sidebar.tsx` - Changed to use settingsStore for hidden files
- `src/stores/fileStore.ts` - Removed duplicate showHiddenFiles state

---

### 3. MCP Tools Configuration
**Status:** Completed
**Priority:** High

**Description:**
Implemented MCP (Model Context Protocol) tools configuration:
- Added MCP server types to ACP types
- Updated createSession to pass enabled MCP servers to backend
- Enhanced MCPSettings UI with environment variables support
- Settings persist via localStorage (aero-code-settings)

**Files modified:**
- `src/types/acp.ts` - Added MCPServerStdio, MCPServerHttp, NewSessionParams types
- `src/services/transport/types.ts` - Updated Transport interface
- `src/services/transport/websocket.ts` - Updated createSession to accept MCP servers
- `src/services/api.ts` - Added getMcpServers() to convert and pass MCP servers
- `src/components/settings/MCPSettings.tsx` - Added environment variables input
- `src/components/ui/textarea.tsx` - New component for environment variables

---

### 4. Model Configuration Management
**Status:** Completed
**Priority:** High

**Description:**
Implemented model configuration:
- Models are fetched from backend via session state
- UI shows available models from the current session
- Can switch models for active session
- Current model is highlighted

**Files modified:**
- `src/components/settings/ModelSettings.tsx` - Complete rewrite to show session models

---

### 5. User Manual and Testing Guide
**Status:** Completed
**Priority:** Medium

**Description:**
Created comprehensive documentation:
- User manual with all features explained
- Testing guide with detailed test cases
- Feature verification checklist

**Files created:**
- `.agent/user-manual.md` - Complete user manual
- `.agent/testing-guide.md` - Detailed testing steps and checklist

---

## Summary

All requested tasks have been completed:

1. **Project Folder Browser** - Browse tab with full directory navigation
2. **Settings Verification** - All settings now properly connected and working
3. **MCP Configuration** - Full support with environment variables, passed to backend on session creation
4. **Model Management** - Dynamic model list from backend, switching support
5. **Documentation** - User manual and testing guide created

## Next Steps (Future Enhancements)

- Persist MCP settings to `.config/aero-code/` on disk (currently localStorage only)
- Add HTTP/SSE MCP server types in UI
- Add model preference persistence
- Add more permission rule configuration options

# Aero Code - Testing Guide

This guide provides detailed testing steps for all major features.

## Prerequisites

Before testing:

1. Set the `ANTHROPIC_API_KEY` environment variable
2. Install dependencies: `bun install`
3. Start the app: `bun run tauri dev` (desktop) or `bun run dev` (web)

---

## Test Suite

### 1. Connection & Auto-Connect

**Test 1.1: Manual Connect**
1. Open the app
2. Ensure Auto Connect is OFF in settings
3. Click "Connect" button in header
4. [ ] Status changes to "Connecting..."
5. [ ] Status changes to "Connected" (green)
6. [ ] Agent info appears in sidebar

**Test 1.2: Auto Connect**
1. Go to Settings > General
2. Enable "Auto Connect"
3. Close and reopen the app
4. [ ] App automatically connects on startup
5. [ ] No manual Connect click needed

**Test 1.3: Disconnect**
1. While connected, click "Disconnect"
2. [ ] Status changes to "Disconnected"
3. [ ] Connection status updates in UI

---

### 2. Project Selection

**Test 2.1: Recent Projects**
1. Click project selector
2. Enter a valid path in the input field
3. Press Enter or click "Open"
4. [ ] Project opens successfully
5. [ ] File tree populates
6. [ ] Path appears in recent projects

**Test 2.2: Browse Mode**
1. Click project selector
2. Switch to "Browse" tab
3. [ ] Current directory loads
4. Navigate using:
   - [ ] ↑ button to go up
   - [ ] Click folder to enter
   - [ ] 🏠 button to go to root
5. Click "Open This Folder"
6. [ ] Project opens successfully

**Test 2.3: Remove Recent Project**
1. Open project selector
2. Hover over a recent project
3. Click trash icon
4. [ ] Project removed from list

---

### 3. Session Management

**Test 3.1: Create Session**
1. With a project open, click `+` next to Sessions
2. [ ] New session created
3. [ ] Session appears in list
4. [ ] Session becomes active

**Test 3.2: Switch Sessions**
1. Create multiple sessions
2. Click on different session in sidebar
3. [ ] Chat view updates to show selected session
4. [ ] Active session is highlighted

**Test 3.3: Delete Session**
1. Hover over a session in sidebar
2. Click trash icon
3. [ ] Session is removed
4. [ ] If active session, another becomes active

**Test 3.4: Resume Session**
1. Create a session and send a message
2. Close the app
3. Reopen and connect
4. [ ] Session appears in list
5. [ ] Click session to resume
6. [ ] Previous messages visible

---

### 4. Chat Interface

**Test 4.1: Send Message**
1. With active session, type a message
2. Press Enter or click Send
3. [ ] Message appears immediately (optimistic)
4. [ ] Agent starts responding
5. [ ] Response streams in real-time

**Test 4.2: Tool Calls**
1. Ask agent to read a file: "Read the package.json file"
2. [ ] Tool call card appears
3. [ ] Card shows "Read" as title
4. [ ] Status progresses: pending → in_progress → completed
5. [ ] Click card to expand/collapse

**Test 4.3: Permission Dialog**
1. Ask agent to create a file: "Create a test file at /tmp/test.txt"
2. [ ] Permission dialog appears
3. [ ] Shows tool request details
4. [ ] Options: Allow Once, Allow Always, Reject
5. Click Allow Once
6. [ ] Dialog closes
7. [ ] Agent continues execution

**Test 4.4: Cancel Prompt**
1. Send a long-running prompt
2. Click Cancel button
3. [ ] Prompt cancellation sent
4. [ ] Agent stops generating

---

### 5. File Browser

**Test 5.1: Navigate Directories**
1. Expand folders by clicking
2. [ ] Children load correctly
3. [ ] Loading indicator shows
4. [ ] Folders show expand arrow

**Test 5.2: Open Files**
1. Click on a text file
2. [ ] File opens in editor
3. [ ] Syntax highlighting applied
4. [ ] Tab appears in editor tabs

**Test 5.3: Open Binary/Image Files**
1. Click on an image file
2. [ ] Image preview shows
3. Click on a PDF file
4. [ ] PDF viewer shows

**Test 5.4: Hidden Files Toggle**
1. Go to Settings > General
2. Toggle "Show Hidden Files"
3. Return to file tree
4. [ ] Hidden files (starting with `.`) show/hide

**Test 5.5: Context Menu Operations**
1. Right-click on a folder
2. [ ] Menu shows: New File, New Folder, Rename, Delete
3. Create new file:
   - [ ] Input field appears
   - [ ] Type name and Enter
   - [ ] File created
4. Rename:
   - [ ] Input pre-filled with current name
   - [ ] Type new name and Enter
   - [ ] File renamed
5. Delete:
   - [ ] Confirmation dialog
   - [ ] File deleted

---

### 6. Code Editor

**Test 6.1: Edit and Save**
1. Open a text file
2. Make changes
3. [ ] Tab shows dirty indicator (dot)
4. Press Cmd/Ctrl + S
5. [ ] File saved
6. [ ] Dirty indicator removed

**Test 6.2: Multiple Tabs**
1. Open multiple files
2. [ ] Each file has a tab
3. Click between tabs
4. [ ] Content switches correctly
5. Close tabs with X button
6. [ ] Tab closes

---

### 7. Settings

**Test 7.1: Theme Switching**
1. Go to Settings > General
2. Click Light, Dark, System buttons
3. [ ] Theme changes immediately
4. [ ] Persists after page reload

**Test 7.2: Auto Clean Sessions**
1. Enable "Auto Clean Empty Sessions"
2. Create a new session (don't send messages)
3. Reload the app
4. [ ] Empty session not shown in list

**Test 7.3: MCP Server Configuration**
1. Go to Settings > MCP Servers
2. Click "Add MCP Server"
3. Fill in:
   - Name: "test-server"
   - Command: "echo"
   - Args: "hello"
4. Click Add Server
5. [ ] Server appears in list
6. [ ] Toggle enables/disables
7. [ ] Delete removes server

**Test 7.4: Model Switching** (requires active session)
1. Go to Settings > Models
2. [ ] Available models listed
3. [ ] Current model marked
4. Click "Use This Model" on another
5. [ ] Model switches
6. [ ] UI updates

---

### 8. Mobile Responsiveness

**Test 8.1: Mobile Layout Switch**
1. Resize browser window to < 768px width
2. [ ] Layout switches to mobile mode
3. [ ] Bottom navigation bar appears
4. [ ] Sidebar becomes drawer

**Test 8.2: Mobile Navigation**
1. Tap Chat icon
2. [ ] Chat view shows
3. Tap Files icon
4. [ ] File tree shows
5. Tap Terminal icon
6. [ ] Terminal view shows
7. Tap Settings icon
8. [ ] Settings show

**Test 8.3: Mobile Sidebar**
1. Tap hamburger menu
2. [ ] Sidebar slides in
3. [ ] Shows sessions and project selector
4. Tap outside to close
5. [ ] Sidebar closes

---

### 9. Error Handling

**Test 9.1: Connection Error**
1. Stop the backend server
2. Try to connect
3. [ ] Error message shows
4. [ ] Status shows error state

**Test 9.2: Invalid Path**
1. Enter invalid path in project selector
2. [ ] Error message shown
3. [ ] App remains stable

**Test 9.3: Permission Denied**
1. Ask agent for restricted operation
2. Click Reject in permission dialog
3. [ ] Agent handles rejection gracefully
4. [ ] Message indicates denial

---

### 10. Performance

**Test 10.1: Long Conversation**
1. Have a conversation with 20+ messages
2. [ ] Scrolling remains smooth
3. [ ] Auto-scroll works
4. [ ] No lag in UI

**Test 10.2: Large File Tree**
1. Open a project with many files
2. Expand multiple directories
3. [ ] Navigation remains responsive
4. [ ] No excessive memory usage

---

## Regression Checklist

Before each release, verify:

- [ ] App starts without errors
- [ ] Auto-connect works
- [ ] Can create/resume/delete sessions
- [ ] Chat messaging works
- [ ] Tool calls display correctly
- [ ] Permissions dialog works
- [ ] File browser navigates correctly
- [ ] Editor saves files
- [ ] Settings persist
- [ ] Theme switching works
- [ ] MCP configuration saves
- [ ] Mobile layout works

---

## Known Limitations

1. **Chinese IME Enter Key**: In desktop Tauri, pressing Enter with Chinese IME may not work correctly
2. **Model Switching**: Only affects current session, not persisted
3. **MCP Changes**: Require new session to take effect
4. **Binary Files**: Cannot be edited in the app

---

## Reporting Issues

When reporting bugs, include:
1. Steps to reproduce
2. Expected vs actual behavior
3. Browser/platform info
4. Console errors (if any)
5. Screenshots if relevant

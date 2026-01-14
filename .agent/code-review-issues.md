# Code Review Issues

Date: 2026-01-15

This document tracks issues identified during comprehensive code review.

---

## Critical Issues

### 1. Memory Leak: useSessionData Event Handler Cleanup

**File:** `src/hooks/useSessionData.ts:362-389`
**Status:** FIXED (2026-01-15)

**Description:**
Direct manipulation of transport's internal `eventHandlers` Map bypasses the transport's public API. The cleanup in useEffect return may be unreliable when transport instance changes.

```typescript
// Line 362: Accessing private implementation details
const eventHandlers = (transport as any).eventHandlers as Map<string, Set<(data: unknown) => void>>;
```

**Potential Problems:**
- Using `as any` to access private properties
- If transport instance is recreated (reconnection), old event handlers may remain
- Cleanup function may not execute if component unmounts during async operations

**Fix Applied:**
1. Added public `onSessionUpdate(sessionId, handler)` method to WebSocketTransport
2. Refactored useSessionData to use public APIs:
   - `transport.onSessionUpdate()` for ACP session updates
   - `transport.onSessionStateUpdate()` for backend state sync
   - `transport.onReconnect()` for reconnection handling
3. All methods now return proper unsubscribe functions used in cleanup

---

### 2. Stale Closure in CodeEditor Save Handler

**File:** `src/components/editor/CodeEditor.tsx:16-43`
**Status:** FIXED (2026-01-15)

**Description:**
The `handleSave` function may not be included in dependencies of `handleEditorMount`, creating stale closure.

```typescript
const handleEditorMount: OnMount = useCallback((editor, monaco) => {
  editorRef.current = editor;
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    handleSave(); // May capture initial handleSave
  });
}, []); // Missing dependency?
```

**Potential Problems:**
- Command handler captures initial `handleSave` from first render
- When `activeFile` changes, command handler still uses old version
- May save wrong file data

**Fix Applied:**
1. Added `handleSaveRef` to store latest handleSave function
2. Added useEffect to keep ref updated when handleSave changes
3. Monaco command now calls `handleSaveRef.current?.()` to always use latest version

---

### 3. Unsafe Type Casting in Service Files

**Files:**
- `src/services/fileService.ts:37-40`
- `src/services/terminalService.ts:17-20`

**Status:** NOT A BUG (Verified 2026-01-15)

**Description:**
Type casting assumes transport is always WebSocketTransport.

```typescript
function getWsTransport(): WebSocketTransport {
  const transport = getTransport();
  return transport as WebSocketTransport; // Cast
}
```

**Verification Result:**
- `getTransport()` in `transport/index.ts` always creates and returns `WebSocketTransport`
- The codebase only uses WebSocketTransport (no alternative implementations)
- The cast is technically safe because the runtime type is always WebSocketTransport

**Conclusion:**
This is a minor code smell, not a runtime bug. The cast is safe in current architecture.
Low priority - could add type guard if alternative transports are added in future.

---

### 4. FileTree Effect Missing Dependencies

**File:** `src/components/editor/FileTree.tsx:390-398`
**Status:** FIXED (2026-01-15)

**Description:**
Effect that reloads directories was missing critical dependencies, causing stale closures.

```typescript
useEffect(() => {
  if (isConnected && currentWorkingDir) {
    loadDirectory(currentWorkingDir);
    expandedPaths.forEach((path) => {
      loadDirectory(path);
    });
  }
}, [showHiddenFiles, refreshTrigger]); // Missing: isConnected, currentWorkingDir?
```

**Potential Problems:**
- Effect may not re-run when dependencies change
- Stale closures over `isConnected` and `currentWorkingDir`

**Fix Applied:**
1. Added refs for values that shouldn't trigger re-runs: `loadDirectoryRef`, `expandedPathsRef`, `isConnectedRef`, `currentWorkingDirRef`
2. Added effect to keep refs synchronized with latest values
3. Effect now reads from refs to always use fresh values without adding unwanted dependencies

---

## High Priority Issues

### 5. No Error Boundary for Component Crashes

**Files:** All React components
**Status:** ENHANCEMENT (Verified 2026-01-15)

**Description:**
No React Error Boundaries implemented. Uncaught errors crash entire app.

**Potential Problems:**
- Poor UX - app becomes unresponsive
- No error recovery mechanism
- Lost work if crash during editing

**Verification Result:**
Confirmed - no ErrorBoundary components exist in codebase.
This is an architectural enhancement, not a bug.

**Recommendation (Future):**
Wrap major sections (Chat, Editor, FileTree, Terminal) in Error Boundaries with fallback UI.
Low priority - defer to future sprint.

---

### 6. Terminal Store State Reference Issue

**File:** `src/stores/terminalStore.ts:69-77`
**Status:** NOT A BUG (Verified 2026-01-15)

**Description:**
In `killTerminal`, after filtering terminals, `state.terminals[0]` was questioned.

```typescript
set((state) => {
  state.terminals = state.terminals.filter((t) => t.id !== terminalId);
  if (state.activeTerminalId === terminalId) {
    state.activeTerminalId = state.terminals[0]?.id ?? null; // After filtering?
  }
});
```

**Verification Result:**
With Immer's proxy system:
1. `filter()` creates new array and assigns to `state.terminals`
2. Subsequent reads of `state.terminals` return the **new filtered array**
3. So `state.terminals[0]` correctly references the first terminal in the filtered result

The code is correct - Immer handles this properly.

---

### 7. Permission Dialog Never Closes on Error

**File:** `src/services/api.ts:182-199`
**Status:** FIXED (2026-01-15)

**Description:**
If error occurs after permission granted but before completion, dialog state not cleaned.

```typescript
const handlePermissionRequest = async (request: PermissionRequest): Promise<PermissionOutcome> => {
  agentStore.setPendingPermission(request);
  return new Promise((resolve) => {
    this.permissionResolver = resolve;
  });
};
// If transport.prompt throws, permissionResolver never called
```

**Potential Problems:**
- Permission dialog remains open if prompt fails
- Memory leak from unresolved promise
- User cannot interact with app

**Fix Applied:**
Added cleanup in finally block:
```typescript
finally {
  sessionStore.setLoading(false);
  // Clean up permission state in case of error during prompt
  if (this.permissionResolver) {
    this.permissionResolver = null;
    agentStore.setPendingPermission(null);
  }
}
```

---

### 8. WebSocket Reconnection Handler Accumulation

**File:** `src/services/transport/websocket.ts:103-125`
**Status:** NOT A BUG (Verified 2026-01-15)

**Description:**
Concern that reconnection may create duplicate event handlers.

```typescript
private handleDisconnect() {
  // ...
  setTimeout(() => {
    this.connect()
      .then(() => {
        this.reconnectHandlers.forEach((handler) => handler());
      })
      .catch(console.error);
  }, delay);
}
```

**Verification Result:**
1. `reconnectHandlers` is a `Set`, so duplicates are impossible
2. Reconnect handlers (like in useSessionData) only call `refresh()` - they don't re-subscribe
3. Event subscriptions happen in useEffect setup, not in reconnect handlers
4. `disconnect()` properly clears eventHandlers when explicitly called

The theoretical concern doesn't apply because reconnect handlers don't add new event listeners.

---

### 9. Multiple `as any` Type Casts

**File:** `src/hooks/useSessionData.ts:362, 406, 409`
**Status:** FIXED BY ISSUE #1 (Verified 2026-01-15)

**Description:**
Multiple uses of `as any` bypassed TypeScript's type system.

```typescript
const eventHandlers = (transport as any).eventHandlers;
(transport as any).onReconnect?.(reconnectHandler);
(transport as any).offReconnect?.(reconnectHandler);
```

**Verification Result:**
These were all fixed as part of Issue #1 fix:
1. `eventHandlers` access replaced with public `transport.onSessionUpdate()` API
2. `onReconnect` now uses public `transport.onReconnect()` method that returns unsubscribe function
3. `offReconnect` no longer needed - using returned unsubscribe function instead

Remaining casts (`as WebSocketTransport`) are safe - same conclusion as Issue #3.

---

## Medium Priority Issues

### 10. No Input Validation for File Paths

**File:** `src/components/editor/FileTree.tsx`
**Status:** ENHANCEMENT (Verified 2026-01-15)

**Description:**
User-provided file/folder names not validated before backend call.

**Potential Problems:**
- Path traversal attacks (`../../etc/passwd`)
- Invalid characters in filenames
- No length limits

**Verification Result:**
No client-side validation exists. However:
- Backend should be the authoritative validator for security
- Client-side validation is a UX/defense-in-depth enhancement
- Not a bug, but recommended future improvement

---

### 11. Excessive Console Logging

**Files:** 22+ files contain console.log/error/warn
**Status:** LOW PRIORITY (Acknowledged)

**Description:**
Console statements present without environment checks.

**Verification Result:**
This is a known code cleanup item. Low priority - does not affect functionality.
Consider implementing a logging service in future if needed.

---

### 12. Missing Loading States for Async Operations

**File:** `src/components/editor/FileTree.tsx`
**Status:** ENHANCEMENT (Verified 2026-01-15)

**Description:**
No loading indicators for rename, delete, create file/folder operations.

**Verification Result:**
- Directory loading has a loading state (`isLoading` property)
- Individual file operations (delete, rename) don't have loading indicators
- This is a UX enhancement, not a bug
- Future improvement: Add disabled state during operations to prevent double-clicks

---

### 13. Component Unmount Cleanup

**File:** `src/components/chat/MessageList.tsx:86-88`
**Status:** NOT A BUG (Verified 2026-01-15)

**Description:**
Initial scroll effect was thought to need cleanup.

```typescript
useEffect(() => {
  scrollToBottom(false);
}, []);
```

**Verification Result:**
- `scrollToBottom` calls `container.scrollTo()` which is a synchronous DOM method
- No async operations or timers that could cause issues on unmount
- No cleanup needed for synchronous DOM operations
- The effect is correctly implemented

---

## Verification Summary (2026-01-15)

All 13 issues have been reviewed:

**FIXED (4 issues):**
- [x] Issue 1: useSessionData memory leak - FIXED (added public API methods)
- [x] Issue 2: CodeEditor handleSave closure - FIXED (using ref pattern)
- [x] Issue 4: FileTree effect dependencies - FIXED (using refs)
- [x] Issue 7: Permission dialog error handling - FIXED (added finally cleanup)

**NOT A BUG (5 issues):**
- [x] Issue 3: Service type casting - NOT A BUG (safe with current architecture)
- [x] Issue 6: Terminal store state reference - NOT A BUG (Immer handles correctly)
- [x] Issue 8: WebSocket reconnection handlers - NOT A BUG (Set prevents duplicates)
- [x] Issue 9: Multiple as any casts - FIXED BY ISSUE #1
- [x] Issue 13: Scroll effect cleanup - NOT A BUG (synchronous operation)

**ENHANCEMENTS (4 issues):**
- [x] Issue 5: Error Boundaries - ENHANCEMENT (defer to future)
- [x] Issue 10: Input validation - ENHANCEMENT (defense-in-depth)
- [x] Issue 11: Console logging - LOW PRIORITY (cleanup task)
- [x] Issue 12: Loading states - ENHANCEMENT (UX improvement)

# Known Issues

## Desktop App: Chinese IME Enter Key Issue

**Status**: Open
**Platform**: Tauri Desktop (macOS)
**Component**: `src/components/chat/ChatInput.tsx`

### Description

When using Chinese input method (IME) in the chat input box, pressing Enter to confirm the IME selection also triggers message send. This issue only occurs in the Tauri desktop app, not in web browser mode.

### Expected Behavior

Pressing Enter while IME is composing should only confirm the character selection, not send the message.

### Current Implementation

```typescript
const handleKeyDown = useCallback(
  (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Check both e.isComposing (native) and isComposingRef (manual tracking for webkit)
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !isComposingRef.current) {
      e.preventDefault();
      handleSend();
    }
  },
  [handleSend]
);

const handleCompositionStart = useCallback(() => {
  isComposingRef.current = true;
}, []);

const handleCompositionEnd = useCallback(() => {
  // Delay reset to ensure keydown event has been processed
  setTimeout(() => {
    isComposingRef.current = false;
  }, 0);
}, []);
```

### Attempted Fixes

1. Using `compositionstart`/`compositionend` events with ref tracking - works in web, not in desktop
2. Added `e.nativeEvent.isComposing` check - still not working in desktop
3. Added `setTimeout` delay in `compositionEnd` - still not working in desktop

### Possible Causes

- Tauri WebView (WebKit on macOS) may have different event ordering than Chrome
- The `keydown` event might fire before `compositionend` in WebKit
- `isComposing` property might not be set correctly in WebKit WebView

### Potential Solutions to Try

1. Use `keyCode === 229` check (229 is the keyCode for IME processing)
2. Check `e.key === "Process"` which some browsers use for IME
3. Investigate Tauri-specific WebView event handling
4. Consider using `keyup` instead of `keydown` for Enter detection

---

## Android PWA: HTTP Standalone Mode Limitation

**Status**: Known Limitation (Browser Security Policy)
**Platform**: Android Chrome
**Component**: `src/components/common/InstallPrompt.tsx`

### Description

When accessing the web app via HTTP (not HTTPS) on Android Chrome, the PWA cannot be installed in true standalone mode. Adding to home screen creates a browser shortcut that opens with the navigation bar visible, not as a fullscreen app.

### Root Cause

Chrome requires HTTPS for full PWA functionality due to security policies. The `beforeinstallprompt` event only fires on secure origins (HTTPS or localhost).

### Current Behavior

- **HTTPS**: Native install prompt, opens as standalone app (no browser UI)
- **HTTP**: Manual "Add to Home screen" instructions shown, opens in browser with address bar

### Workaround

Users can enable Chrome flags to treat specific HTTP origins as secure:

1. Open Chrome on Android, navigate to:
   ```
   chrome://flags/#unsafely-treat-insecure-origin-as-secure
   ```

2. Add the server address (e.g., `http://192.168.1.100:1420`)

3. Set to `Enabled` and relaunch Chrome

4. Reinstall the PWA - it will now work in standalone mode

### Alternative Solutions

1. **Self-signed HTTPS certificate**: Configure the server with HTTPS using mkcert or similar
2. **Use localhost**: Access via `localhost` which is treated as secure
3. **Reverse proxy with HTTPS**: Use nginx/caddy with Let's Encrypt for public access

---

## Android WebView: Keyboard Not Pushing Input Up (RESOLVED)

**Status**: Resolved
**Platform**: Android Tauri WebView
**Component**: `MainActivity.kt`, `MobileLayout.tsx`

### Description

On Android Tauri app with `enableEdgeToEdge()` enabled, the virtual keyboard does not push the input field up. Standard `windowSoftInputMode="adjustResize"` does not work in edge-to-edge (fullscreen) mode.

### Root Cause

Android WebView Bug #36911528 - `adjustResize` behavior is broken when the app uses edge-to-edge rendering. The `visualViewport` API also doesn't fire resize events in this mode.

### Solution

Implemented native keyboard detection using Android WindowInsets API:

1. **MainActivity.kt** - Listen for keyboard height via `WindowInsetsCompat.Type.ime()`:
   ```kotlin
   ViewCompat.setOnApplyWindowInsetsListener(rootView) { view, insets ->
     val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
     val navBarInsets = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
     // IME includes nav bar, subtract to get pure keyboard height
     val pureKeyboardHeight = imeInsets.bottom - navBarInsets.bottom
     notifyKeyboardHeight(pureKeyboardHeight)
     insets
   }
   ```

2. **Send to WebView** via `evaluateJavascript`:
   ```kotlin
   webView?.evaluateJavascript(
     "window.dispatchEvent(new CustomEvent('androidKeyboardHeight', { detail: { height: $height } }));",
     null
   )
   ```

3. **MobileLayout.tsx** - Listen for event and adjust container height:
   ```typescript
   const [keyboardHeight, setKeyboardHeight] = useState(0);
   useEffect(() => {
     const handler = (e: CustomEvent<{ height: number }>) => {
       // Convert physical pixels to CSS pixels
       const cssPx = Math.round(e.detail.height / window.devicePixelRatio);
       setKeyboardHeight(cssPx);
     };
     window.addEventListener("androidKeyboardHeight", handler);
     return () => window.removeEventListener("androidKeyboardHeight", handler);
   }, []);
   ```

4. **TabBar handling** - Subtract TabBar height from offset so it gets pushed behind keyboard:
   ```typescript
   const TAB_BAR_HEIGHT = 56;
   const keyboardOffset = isTabBarVisible ? keyboardHeight - TAB_BAR_HEIGHT : keyboardHeight;
   ```

### Key Learnings

- Android returns physical pixels, must divide by `devicePixelRatio` for CSS pixels
- IME insets include navigation bar height, must subtract `navigationBars().bottom`
- `src-tauri/gen/android/` files are generated but can be manually edited and preserved

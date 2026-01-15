import { create } from "zustand";

/**
 * Mobile Navigation Views
 *
 * - session-list: Chat tab showing all sessions (main view)
 * - conversation: Inside a conversation (no tab bar, has back button)
 * - files: Files tab with file tree
 * - file-viewer: Viewing a file (no tab bar, has back button)
 * - terminal: Terminal tab
 * - settings: Settings tab
 */
export type MobileView =
  | "session-list"
  | "conversation"
  | "files"
  | "file-viewer"
  | "terminal"
  | "settings";

// Views where tab bar should be hidden
const VIEWS_WITHOUT_TAB_BAR: MobileView[] = ["conversation", "file-viewer"];

// Views where back button should be shown
const VIEWS_WITH_BACK_BUTTON: MobileView[] = ["conversation", "file-viewer"];

interface MobileNavState {
  currentView: MobileView;
  previousView: MobileView | null;
  viewingFilePath: string | null;

  // Computed-like getters
  showTabBar: () => boolean;
  showBackButton: () => boolean;

  // Navigation actions
  setView: (view: MobileView) => void;
  enterConversation: () => void;
  exitConversation: () => void;
  goBack: () => void;
  openFileViewer: (filePath: string) => void;
  closeFileViewer: () => void;
}

export const useMobileNavStore = create<MobileNavState>((set, get) => ({
  currentView: "session-list",
  previousView: null,
  viewingFilePath: null,

  // Check if tab bar should be shown
  showTabBar: () => {
    const { currentView } = get();
    return !VIEWS_WITHOUT_TAB_BAR.includes(currentView);
  },

  // Check if back button should be shown
  showBackButton: () => {
    const { currentView } = get();
    return VIEWS_WITH_BACK_BUTTON.includes(currentView);
  },

  // Set view directly (for tab navigation)
  setView: (view) =>
    set((state) => ({
      previousView: state.currentView,
      currentView: view,
      // Clear file viewer path if leaving file-viewer
      viewingFilePath: view === "file-viewer" ? state.viewingFilePath : null,
    })),

  // Enter conversation view from session list
  enterConversation: () =>
    set((state) => ({
      previousView: state.currentView,
      currentView: "conversation",
    })),

  // Exit conversation view back to session list
  exitConversation: () =>
    set({
      previousView: "conversation",
      currentView: "session-list",
    }),

  // Generic back navigation
  goBack: () =>
    set((state) => {
      // Determine where to go back to
      let targetView: MobileView = "session-list";

      if (state.currentView === "conversation") {
        targetView = "session-list";
      } else if (state.currentView === "file-viewer") {
        targetView = "files";
      } else if (state.previousView) {
        targetView = state.previousView;
      }

      return {
        currentView: targetView,
        previousView: state.currentView,
        viewingFilePath: state.currentView === "file-viewer" ? null : state.viewingFilePath,
      };
    }),

  // Open file viewer from files tab
  openFileViewer: (filePath) =>
    set((state) => ({
      previousView: state.currentView,
      currentView: "file-viewer",
      viewingFilePath: filePath,
    })),

  // Close file viewer
  closeFileViewer: () =>
    set((state) => ({
      previousView: state.currentView,
      currentView: "files",
      viewingFilePath: null,
    })),
}));

import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useMobileNavStore, type MobileView } from "@/stores/mobileNavStore";
import { MessageSquare, FolderTree, Terminal, Settings } from "lucide-react";

interface TabItem {
  id: MobileView;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TAB_ITEMS: TabItem[] = [
  { id: "session-list", labelKey: "tabs.chat", icon: MessageSquare },
  { id: "files", labelKey: "tabs.files", icon: FolderTree },
  { id: "terminal", labelKey: "tabs.terminal", icon: Terminal },
  { id: "settings", labelKey: "tabs.settings", icon: Settings },
];

export function MobileTabBar() {
  const { t } = useTranslation();
  const currentView = useMobileNavStore((state) => state.currentView);
  const showTabBar = useMobileNavStore((state) => state.showTabBar);
  const setView = useMobileNavStore((state) => state.setView);

  // Hide tab bar based on current view
  if (!showTabBar()) {
    return null;
  }

  // Map certain views to their "parent" tab for highlighting
  const getActiveTab = (view: MobileView): MobileView => {
    // file-viewer should highlight Files tab, but we hide the bar anyway
    // conversation should highlight Chat tab, but we hide the bar anyway
    return view;
  };

  const activeTab = getActiveTab(currentView);

  return (
    <nav className="border-t border-border bg-card flex-shrink-0">
      {/* Tab buttons container with fixed height */}
      <div className="h-14 flex items-center justify-around">
        {TAB_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium leading-none">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
      {/* iOS safe area spacer - this adds extra space below the tabs */}
      <div className="safe-area-bottom" />
    </nav>
  );
}

// Keep old name as alias for backward compatibility during transition
export { MobileTabBar as MobileNavBar };

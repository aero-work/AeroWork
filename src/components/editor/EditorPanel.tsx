import { EditorTabs } from "./EditorTabs";
import { CodeEditor } from "./CodeEditor";

export function EditorPanel() {
  return (
    <div className="flex flex-col h-full">
      <EditorTabs />
      <CodeEditor />
    </div>
  );
}

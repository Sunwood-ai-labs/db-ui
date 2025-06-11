"use client";

import { useState, useRef } from "react";
import Editor from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { cn } from "../lib/utils";
import { useTheme } from "next-themes";

interface JSONEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export default function JSONEditor({
  value,
  onChange,
  className,
  placeholder = "Enter JSON...",
}: JSONEditorProps) {
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { theme, resolvedTheme } = useTheme();

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor;
  };

  const handleChange = (newValue: string | undefined) => {
    const jsonValue = newValue || "";
    onChange(jsonValue);

    // Validate JSON
    if (jsonValue.trim()) {
      try {
        JSON.parse(jsonValue);
        setIsValid(true);
        setError(null);
      } catch (err) {
        setIsValid(false);
        setError(err instanceof Error ? err.message : "Invalid JSON");
      }
    } else {
      setIsValid(true);
      setError(null);
    }
  };

  // Determine Monaco theme based on current theme
  const getMonacoTheme = () => {
    if (theme === "system") {
      return resolvedTheme === "dark" ? "vs-dark" : "vs";
    }
    return theme === "dark" ? "vs-dark" : "vs";
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="border rounded-md overflow-hidden">
        <Editor
          height="200px"
          defaultLanguage="json"
          value={value}
          onChange={handleChange}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            folding: true,
            wordWrap: "on",
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            tabSize: 2,
            insertSpaces: true,
            fontSize: 14,
          }}
          theme={getMonacoTheme()}
        />
      </div>
      {!isValid && error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2">
          <strong>JSON Error:</strong> {error}
        </div>
      )}
      {!value && (
        <div className="text-sm text-muted-foreground">{placeholder}</div>
      )}
    </div>
  );
}

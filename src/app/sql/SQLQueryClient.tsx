"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Play, AlertCircle, CheckCircle, Download } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import Editor from "@monaco-editor/react";
import type * as monaco from "monaco-editor";
import { useTheme } from "next-themes";

interface QueryResult {
  success: boolean;
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
  error?: string;
}

export default function SQLQueryClient() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const { theme, resolvedTheme } = useTheme();

  const runQuery = async (query: string) => {
    if (!query.trim()) return;

    setIsRunning(true);
    setResult(null);
    setCurrentPage(1); // Reset to first page on new query

    try {
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        error: "Failed to execute query",
        rows: [],
        rowCount: 0,
        fields: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  const exportToCSV = () => {
    if (!result || !result.success || result.rows.length === 0) return;

    // Create CSV content
    const headers = result.fields.join(",");
    const rows = result.rows
      .map((row) =>
        result.fields
          .map((field) => {
            const value = row[field];
            if (value === null) return "";
            const stringValue = String(value);
            // Escape quotes and wrap in quotes if contains comma, quote, or newline
            if (
              stringValue.includes(",") ||
              stringValue.includes('"') ||
              stringValue.includes("\n")
            ) {
              return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
          })
          .join(",")
      )
      .join("\n");

    const csvContent = `${headers}\n${rows}`;

    // Create and trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `query_results_${new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-")}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleEditorDidMount = (
    editor: monaco.editor.IStandaloneCodeEditor
  ) => {
    editorRef.current = editor;

    editor.addAction({
      id: "run-code",
      label: "Run Code",
      // contextMenuOrder: 2,
      // contextMenuGroupId: "1_modification",
      keybindings: [2048 | 3],
      run: () => {
        runQuery(editor.getValue());
      },
    });

    // Focus the editor
    editor.focus();
  };

  // Calculate pagination values
  const totalRows = result?.rows.length || 0;
  const totalPages = Math.ceil(totalRows / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedRows = result?.rows.slice(startIndex, endIndex) || [];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setCurrentPage(1); // Reset to first page when changing page size
  };

  // Determine Monaco theme based on current theme
  const getMonacoTheme = () => {
    if (theme === "system") {
      return resolvedTheme === "dark" ? "vs-dark" : "vs-light";
    }
    return theme === "dark" ? "vs-dark" : "vs-light";
  };

  const formatCellValue = (value: unknown): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-muted-foreground italic">null</span>;
    }

    // Check if the value looks like JSON (starts with { or [)
    if (
      typeof value === "string" &&
      (value.startsWith("{") || value.startsWith("["))
    ) {
      try {
        const parsed = JSON.parse(value);
        return (
          <pre className="whitespace-pre-wrap font-mono text-xs">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      } catch {
        // If parsing fails, return the original string
        return String(value);
      }
    } else if (typeof value === "object") {
      // If it's already an object, stringify it
      return (
        <pre className="whitespace-pre-wrap font-mono text-xs">
          {JSON.stringify(value, null, 2)}
        </pre>
      );
    }

    return String(value);
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex flex-row gap-2">
            <SidebarTrigger />
            <h2 className="text-xl font-semibold">Run SQL</h2>
          </div>
          <Button
            onClick={() => runQuery(editorRef.current?.getValue() || "")}
            disabled={isRunning || !editorRef.current?.getValue().trim()}
            className="flex items-center gap-2"
          >
            <Play className="w-4 h-4" />
            {isRunning ? "Running..." : "Run Query"}
            <span className="text-xs text-muted-foreground ml-2">⌘+Enter</span>
          </Button>
        </div>
      </div>

      {/* SQL Editor */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="p-4 border-b">
          <div className="border border-border rounded-md overflow-hidden">
            <Editor
              height="200px"
              defaultLanguage="sql"
              onMount={handleEditorDidMount}
              theme={getMonacoTheme()}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: "on",
                scrollBeyondLastLine: false,
                automaticLayout: true,
                tabSize: 2,
                insertSpaces: true,
                wordWrap: "on",
                contextmenu: true,
                selectOnLineNumbers: true,
                // roundedSelection: false,
                readOnly: false,
                cursorStyle: "line",
                // glyphMargin: false,
                // folding: false,
                // showFoldingControls: "never",
                lineDecorationsWidth: 4,
                lineNumbersMinChars: 3,
                renderLineHighlight: "none",
                scrollbar: {
                  vertical: "hidden",
                },
                padding: {
                  top: 10,
                  bottom: 10,
                },
                overviewRulerLanes: 0,
                overviewRulerBorder: false,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Cmd+Enter (or Ctrl+Enter) to run the query
          </p>
        </div>

        {/* Results */}
        <div className="flex-1">
          {result && (
            <div className="p-4">
              {/* Status and Export */}
              <div className="mb-4 flex items-center justify-between">
                <div>
                  {result.success ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm">
                        Query executed successfully. {result.rowCount} row(s).
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span className="text-sm">
                        Query failed: {result.error}
                      </span>
                    </div>
                  )}
                </div>

                {/* Export Button */}
                {result.success && result.rows.length > 0 && (
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                )}
              </div>

              {/* Results Table */}
              {result.success && result.rows.length > 0 && (
                <>
                  <div className="border rounded-md w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {result.fields.map((field) => (
                            <TableHead key={field}>{field}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedRows.map((row, index) => (
                          <TableRow key={startIndex + index}>
                            {result.fields.map((field) => (
                              <TableCell key={`${startIndex + index}-${field}`}>
                                {formatCellValue(row[field])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination Controls */}
                  {totalRows > pageSize && (
                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          Rows per page
                        </span>
                        <Select
                          value={pageSize.toString()}
                          onValueChange={handlePageSizeChange}
                        >
                          <SelectTrigger className="h-8 w-[70px]">
                            <SelectValue placeholder={pageSize} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10</SelectItem>
                            <SelectItem value="20">20</SelectItem>
                            <SelectItem value="50">50</SelectItem>
                            <SelectItem value="100">100</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {totalRows} total rows • Showing{" "}
                          {Math.min(startIndex + 1, totalRows)}-
                          {Math.min(endIndex, totalRows)}
                        </span>
                        <Pagination
                          currentPage={currentPage}
                          totalPages={totalPages}
                          onPageChange={handlePageChange}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* No Results */}
              {result.success && result.rows.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No results returned
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {!result && (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">Ready to run SQL queries</p>
                <p className="text-sm">
                  Enter a query above and click &quot;Run Query&quot; or press
                  Cmd+Enter
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

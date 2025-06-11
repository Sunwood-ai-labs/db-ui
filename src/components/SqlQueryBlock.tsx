"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface QueryResult {
  success: boolean;
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
  error?: string;
}

interface SqlQueryBlockProps {
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: {
      query: string;
      description: string;
    };
  };
  onExecute: (toolCallId: string, result: QueryResult) => void;
}

export function SqlQueryBlock({ toolCall, onExecute }: SqlQueryBlockProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [hasExecuted, setHasExecuted] = useState(false);

  const executeQuery = async () => {
    setIsExecuting(true);
    try {
      const response = await fetch("/api/execute-sql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: toolCall.args.query,
          toolCallId: toolCall.toolCallId,
        }),
      });

      const data = await response.json();
      const queryResult: QueryResult = {
        success: data.success,
        rows: data.rows,
        rowCount: data.rowCount,
        fields: data.fields,
        error: data.error,
      };

      setResult(queryResult);
      setHasExecuted(true);

      // Notify parent component with the results
      onExecute(toolCall.toolCallId, queryResult);
    } catch {
      const errorResult: QueryResult = {
        success: false,
        error: "Failed to execute query",
        rows: [],
        rowCount: 0,
        fields: [],
      };
      setResult(errorResult);
      setHasExecuted(true);
      onExecute(toolCall.toolCallId, errorResult);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Card className="my-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="text-sm font-medium">SQL Query</span>
          {hasExecuted && result?.success && (
            <CheckCircle className="h-4 w-4 text-green-600" />
          )}
          {hasExecuted && !result?.success && (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
        </CardTitle>
        {toolCall.args.description && (
          <p className="text-sm text-muted-foreground">
            {toolCall.args.description}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* SQL Query Display */}
        <div className="border rounded-md overflow-hidden">
          <SyntaxHighlighter
            language="sql"
            style={oneDark as Record<string, React.CSSProperties>}
            customStyle={{
              margin: 0,
              fontSize: "14px",
            }}
          >
            {toolCall.args.query}
          </SyntaxHighlighter>
        </div>

        {/* Execute Button */}
        {!hasExecuted && (
          <Button
            onClick={executeQuery}
            disabled={isExecuting}
            className="w-full"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Execute Query
              </>
            )}
          </Button>
        )}

        {/* Results Display */}
        {result && (
          <div className="space-y-4">
            {/* Status */}
            <div>
              {result.success ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">
                    Query executed successfully. {result.rowCount} row(s)
                    returned.
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Query failed: {result.error}</span>
                </div>
              )}
            </div>

            {/* Results Table */}
            {result.success && result.rows.length > 0 && (
              <div className="border rounded-md">
                <div className="max-h-80 overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {result.fields.map((field) => (
                          <TableHead key={field}>{field}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.slice(0, 50).map((row, index) => (
                        <TableRow key={index}>
                          {result.fields.map((field) => (
                            <TableCell key={`${index}-${field}`}>
                              {row[field] === null ? (
                                <span className="text-muted-foreground italic">
                                  null
                                </span>
                              ) : (
                                String(row[field])
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {result.rows.length > 50 && (
                  <div className="p-2 text-sm text-muted-foreground text-center border-t">
                    Showing first 50 rows of {result.rows.length} total rows
                  </div>
                )}
              </div>
            )}

            {/* No Results */}
            {result.success && result.rows.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No results returned
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

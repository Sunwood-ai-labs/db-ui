"use client";

// Force dynamic rendering since this page is a client component with API interactions
export const dynamic = "force-dynamic";

import { useChat } from "ai/react";
import { Send, MessageSquare, Database, Bot, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { SqlQueryBlock } from "@/components/SqlQueryBlock";

interface CodeProps {
  className?: string;
  children?: React.ReactNode;
}

interface ToolExecutionResult {
  success: boolean;
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
  error?: string;
}

export default function ChatPage() {
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    addToolResult,
  } = useChat({
    api: "/api/chat",
  });

  const handleToolExecution = async (
    toolCallId: string,
    result: ToolExecutionResult
  ) => {
    // Add the tool result to the conversation using AI SDK's built-in method
    addToolResult({
      toolCallId,
      result: {
        success: result.success,
        data: result.rows,
        rowCount: result.rowCount,
        fields: result.fields,
        error: result.error,
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto p-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              <MessageSquare className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Chat with DB</h1>
              <p className="text-sm text-muted-foreground">
                Ask questions about your database structure and data
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 container mx-auto p-4">
        <div className="h-full max-w-4xl mx-auto flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5" />
                      Welcome to Database Chat
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground mb-4">
                      I&apos;m your database assistant powered by Groq! I have
                      access to your database schema and can help you with:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                      <li>Understanding table structures and relationships</li>
                      <li>Writing SQL queries for specific data needs</li>
                      <li>Explaining database design patterns</li>
                      <li>Suggesting optimizations and best practices</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-4">
                      Try asking: &quot;What tables do we have?&quot; or
                      &quot;Show me the structure of the users table&quot;
                    </p>
                  </CardContent>
                </Card>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex gap-3 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`flex gap-3 max-w-[90%] ${
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    }`}
                  >
                    <div
                      className={`flex-shrink-0 ${
                        message.role === "user" ? "order-2" : "order-1"
                      }`}
                    >
                      {message.role === "user" ? (
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                          <Bot className="h-4 w-4 text-secondary-foreground" />
                        </div>
                      )}
                    </div>
                    <div
                      className={`rounded-lg p-3 ${
                        message.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      }`}
                    >
                      {message.role === "user" ? (
                        <div className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Render message parts in order */}
                          {message.parts?.map((part, index) => {
                            const partKey = `${message.id}-part-${index}`;

                            switch (part.type) {
                              case "text":
                                return (
                                  <div
                                    key={partKey}
                                    className="text-sm prose prose-sm max-w-none dark:prose-invert"
                                  >
                                    <ReactMarkdown
                                      components={{
                                        code({
                                          className,
                                          children,
                                          ...props
                                        }: CodeProps) {
                                          const match = /language-(\w+)/.exec(
                                            className || ""
                                          );
                                          const isInline = !match;
                                          return !isInline ? (
                                            <SyntaxHighlighter
                                              style={
                                                oneDark as Record<
                                                  string,
                                                  React.CSSProperties
                                                >
                                              }
                                              language={match[1]}
                                              PreTag="div"
                                              className="rounded-md"
                                            >
                                              {String(children).replace(
                                                /\n$/,
                                                ""
                                              )}
                                            </SyntaxHighlighter>
                                          ) : (
                                            <code
                                              className={className}
                                              {...props}
                                            >
                                              {children}
                                            </code>
                                          );
                                        },
                                      }}
                                    >
                                      {part.text}
                                    </ReactMarkdown>
                                  </div>
                                );

                              case "tool-invocation":
                                if (
                                  part.toolInvocation.toolName === "execute_sql"
                                ) {
                                  return (
                                    <SqlQueryBlock
                                      key={partKey}
                                      toolCall={{
                                        toolCallId:
                                          part.toolInvocation.toolCallId,
                                        toolName: part.toolInvocation.toolName,
                                        args: part.toolInvocation.args as {
                                          query: string;
                                          description: string;
                                        },
                                      }}
                                      onExecute={handleToolExecution}
                                    />
                                  );
                                }
                                return null;

                              default:
                                return null;
                            }
                          })}

                          {/* Fallback for legacy content field if parts is empty */}
                          {(!message.parts || message.parts.length === 0) &&
                            message.content && (
                              <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                                <ReactMarkdown
                                  components={{
                                    code({
                                      className,
                                      children,
                                      ...props
                                    }: CodeProps) {
                                      const match = /language-(\w+)/.exec(
                                        className || ""
                                      );
                                      const isInline = !match;
                                      return !isInline ? (
                                        <SyntaxHighlighter
                                          style={
                                            oneDark as Record<
                                              string,
                                              React.CSSProperties
                                            >
                                          }
                                          language={match[1]}
                                          PreTag="div"
                                          className="rounded-md"
                                        >
                                          {String(children).replace(/\n$/, "")}
                                        </SyntaxHighlighter>
                                      ) : (
                                        <code className={className} {...props}>
                                          {children}
                                        </code>
                                      );
                                    },
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 justify-start">
                  <div className="flex gap-3 max-w-[80%]">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                      <Bot className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div className="rounded-lg p-3 bg-muted">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                          <div className="w-2 h-2 bg-current rounded-full animate-bounce"></div>
                        </div>
                        Thinking...
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="mt-4 border-t pt-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask about your database..."
                disabled={isLoading}
                className="flex-1"
                autoFocus
              />
              <Button type="submit" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

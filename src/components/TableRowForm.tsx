import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { AlertCircle } from "lucide-react";
import JSONEditor from "./JSONEditor";

interface TableRowFormProps {
  columns: string[];
  columnTypes?: Record<string, { dataType: string; udtName: string }>;
  initialData?: Record<string, string>;
  onSubmit: (data: Record<string, string>) => Promise<void>;
  submitButtonText: string;
  onCancel?: () => void;
}

export default function TableRowForm({
  columns,
  columnTypes = {},
  initialData = {},
  onSubmit,
  submitButtonText,
  onCancel,
}: TableRowFormProps) {
  const [formData, setFormData] = useState<Record<string, string>>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Error submitting form:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to submit. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (column: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [column]: value,
    }));
  };

  const isJsonField = (column: string): boolean => {
    const columnType = columnTypes[column];
    if (!columnType) return false;

    return (
      columnType.dataType === "json" ||
      columnType.udtName === "json" ||
      columnType.udtName === "jsonb"
    );
  };

  const formatInitialJsonValue = (value: string): string => {
    if (!value) return "";
    try {
      // If it's already valid JSON, format it nicely
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If it's not valid JSON, return as-is
      return value;
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col p-4 pt-0 gap-4 overflow-y-auto"
    >
      {columns.map((column) => (
        <div key={column}>
          <label htmlFor={column} className="text-sm font-medium">
            {column}
            {columnTypes[column] && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({columnTypes[column].udtName})
              </span>
            )}
          </label>
          {isJsonField(column) ? (
            <JSONEditor
              value={formatInitialJsonValue(formData[column] || "")}
              onChange={(value) => handleInputChange(column, value)}
              placeholder={`Enter JSON for ${column}...`}
            />
          ) : (
            <Input
              id={column}
              value={formData[column] || ""}
              onChange={(e) => handleInputChange(column, e.target.value)}
            />
          )}
        </div>
      ))}

      {error && (
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button type="submit" className="flex-1" disabled={isLoading}>
          {isLoading ? "Submitting..." : submitButtonText}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}

"use client";

import { Button } from "./ui/button";
import { Combobox } from "./ui/combobox";
import { X } from "lucide-react";

interface Filter {
  column: string;
  operator: string;
  value: string;
}

interface FilterBarProps {
  columns: string[];
  pendingFilters: Filter[];
  setPendingFilters: (filters: Filter[]) => void;
}

const operators = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not Equals" },
  { value: ">", label: "Greater Than" },
  { value: "<", label: "Less Than" },
  { value: ">=", label: "Greater Than or Equal" },
  { value: "<=", label: "Less Than or Equal" },
  { value: "LIKE", label: "Contains" },
  { value: "NOT LIKE", label: "Does Not Contain" },
];

export default function FilterBar({
  columns,
  pendingFilters,
  setPendingFilters,
}: FilterBarProps) {
  const addFilter = () => {
    const newFilters = [
      ...pendingFilters,
      { column: columns[0], operator: "=", value: "" },
    ];
    setPendingFilters(newFilters);
  };

  const removeFilter = (index: number) => {
    const newFilters = pendingFilters.filter((_, i) => i !== index);
    setPendingFilters(newFilters);
  };

  const updateFilter = (index: number, field: keyof Filter, value: string) => {
    const newFilters = [...pendingFilters];
    newFilters[index] = { ...newFilters[index], [field]: value };
    setPendingFilters(newFilters);
  };

  // Convert columns to options for combobox
  const columnOptions = columns.map((column) => ({
    value: column,
    label: column,
  }));

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Filters</h3>
        <Button size="sm" type="button" onClick={addFilter} variant="outline">
          Add Filter
        </Button>
      </div>

      {pendingFilters.map((filter, index) => (
        <div key={index} className="flex items-center gap-2">
          <Combobox
            options={columnOptions}
            value={filter.column}
            onValueChange={(value) => updateFilter(index, "column", value)}
            placeholder="Select column"
            searchPlaceholder="Search columns..."
            emptyMessage="No column found."
          />

          <Combobox
            options={operators}
            value={filter.operator}
            onValueChange={(value) => updateFilter(index, "operator", value)}
            placeholder="Select operator"
            searchPlaceholder="Search operators..."
            emptyMessage="No operator found."
          />

          <input
            type="text"
            value={filter.value}
            onChange={(e) => updateFilter(index, "value", e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Value"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeFilter(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

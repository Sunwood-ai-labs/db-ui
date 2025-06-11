"use client";

import { Button } from "./ui/button";
import { Combobox } from "./ui/combobox";
import { X } from "lucide-react";

interface Sort {
  column: string;
  direction: "asc" | "desc";
}

interface SortBarProps {
  columns: string[];
  pendingSorts: Sort[];
  setPendingSorts: (sorts: Sort[]) => void;
}

const directions = [
  { value: "asc", label: "Ascending" },
  { value: "desc", label: "Descending" },
];

export default function SortBar({
  columns,
  pendingSorts,
  setPendingSorts,
}: SortBarProps) {
  const addSort = () => {
    const newSorts = [
      ...pendingSorts,
      { column: columns[0], direction: "asc" as const },
    ];
    setPendingSorts(newSorts);
  };

  const removeSort = (index: number) => {
    const newSorts = pendingSorts.filter((_, i) => i !== index);
    setPendingSorts(newSorts);
  };

  const updateSort = (index: number, field: keyof Sort, value: string) => {
    const newSorts = [...pendingSorts];
    newSorts[index] = { ...newSorts[index], [field]: value };
    setPendingSorts(newSorts);
  };

  // Convert columns to options for combobox
  const columnOptions = columns.map((column) => ({
    value: column,
    label: column,
  }));

  return (
    <div className="px-2 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Sorting</h3>
        <Button size="sm" type="button" onClick={addSort} variant="outline">
          Add Sort
        </Button>
      </div>

      {pendingSorts.map((sort, index) => (
        <div key={index} className="flex items-center gap-2">
          <Combobox
            options={columnOptions}
            value={sort.column}
            onValueChange={(value) => updateSort(index, "column", value)}
            placeholder="Select column"
            searchPlaceholder="Search columns..."
            emptyMessage="No column found."
          />

          <Combobox
            options={directions}
            value={sort.direction}
            onValueChange={(value) => updateSort(index, "direction", value)}
            placeholder="Select direction"
            searchPlaceholder="Search directions..."
            emptyMessage="No direction found."
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => removeSort(index)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}

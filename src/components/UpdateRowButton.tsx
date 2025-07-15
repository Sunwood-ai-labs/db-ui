"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTableRow } from "@/lib/db";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Pencil } from "lucide-react";
import TableRowForm from "./TableRowForm";
import { IntrospectionColumn } from "@/lib/types";

interface UpdateRowButtonProps {
  tableName: string;
  columns: string[];
  columnTypes: Record<string, { dataType: string; udtName: string }>;
  rowData: Record<string, string | number | boolean | Date>;
  primaryKeys: string[];
  introspection?: {
    columns: IntrospectionColumn[];
  };
}

export default function UpdateRowButton({
  tableName,
  columns,
  columnTypes,
  rowData,
  primaryKeys,
  introspection,
}: UpdateRowButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // Filter out read-only columns (identity columns, primary keys, and auto-managed timestamps)
  const getEditableColumns = (): string[] => {
    if (!introspection) {
      // Fallback: exclude primary keys and identity columns
      return columns.filter((col) => !primaryKeys.includes(col));
    }

    return columns.filter((columnName) => {
      const columnInfo = introspection.columns.find(
        (col) => col.column_name === columnName
      );

      // Exclude identity columns (auto-increment/serial columns)
      if (columnInfo?.is_identity === "YES") {
        return false;
      }

      return true;
    });
  };

  // Get columns that should be shown as readonly (primary keys and identity columns)
  const getReadonlyColumns = (): string[] => {
    if (!introspection) {
      return primaryKeys;
    }

    return columns.filter((columnName) => {
      const columnInfo = introspection.columns.find(
        (col) => col.column_name === columnName
      );

      // Include identity columns and primary keys as readonly
      return (
        columnInfo?.is_identity === "YES" || primaryKeys.includes(columnName)
      );
    });
  };

  const editableColumns = getEditableColumns();
  const readonlyColumns = getReadonlyColumns();

  const handleSubmit = async (formData: Record<string, string>) => {
    // Build primary key values object from rowData
    const primaryKeyValues: Record<string, string | number> = {};
    primaryKeys.forEach((key) => {
      const value = rowData[key];
      if (value !== undefined) {
        primaryKeyValues[key] =
          typeof value === "string" ? value : String(value);
      }
    });

    // Only send data for editable columns
    const filteredFormData: Record<string, string> = {};
    editableColumns.forEach((column) => {
      if (formData[column] !== undefined) {
        filteredFormData[column] = formData[column];
      }
    });

    await updateTableRow(tableName, primaryKeyValues, filteredFormData);
    setIsOpen(false);
    router.refresh();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Update row in {tableName}</SheetTitle>
        </SheetHeader>
        <TableRowForm
          columns={editableColumns}
          columnTypes={columnTypes}
          initialData={Object.fromEntries(
            editableColumns.map((column) => [
              column,
              String(rowData[column] || ""),
            ])
          )}
          readonlyColumns={readonlyColumns}
          readonlyData={Object.fromEntries(
            readonlyColumns.map((column) => [
              column,
              String(rowData[column] || ""),
            ])
          )}
          onSubmit={handleSubmit}
          submitButtonText="Update Row"
          onCancel={() => setIsOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

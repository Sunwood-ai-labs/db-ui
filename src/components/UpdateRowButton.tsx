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

interface UpdateRowButtonProps {
  tableName: string;
  columns: string[];
  columnTypes: Record<string, { dataType: string; udtName: string }>;
  rowData: Record<string, string | number | boolean>;
  primaryKeys: string[];
}

export default function UpdateRowButton({
  tableName,
  columns,
  columnTypes,
  rowData,
  primaryKeys,
}: UpdateRowButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

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

    await updateTableRow(tableName, primaryKeyValues, formData);
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
          columns={columns}
          columnTypes={columnTypes}
          initialData={Object.fromEntries(
            Object.entries(rowData).map(([key, value]) => [key, String(value)])
          )}
          onSubmit={handleSubmit}
          submitButtonText="Update Row"
          onCancel={() => setIsOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

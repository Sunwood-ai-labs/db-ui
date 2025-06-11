"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { insertTableRow } from "@/lib/db";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Plus } from "lucide-react";
import TableRowForm from "./TableRowForm";

interface AddRowButtonProps {
  tableName: string;
  columns: string[];
  columnTypes: Record<string, { dataType: string; udtName: string }>;
}

export default function AddRowButton({
  tableName,
  columns,
  columnTypes,
}: AddRowButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  const handleSubmit = async (formData: Record<string, string>) => {
    await insertTableRow(tableName, formData);
    setIsOpen(false);
    router.refresh();
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Row
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add New Row to {tableName}</SheetTitle>
        </SheetHeader>
        <TableRowForm
          columns={columns}
          columnTypes={columnTypes}
          onSubmit={handleSubmit}
          submitButtonText="Add Row"
          onCancel={() => setIsOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteTableRow } from "@/lib/db";
import { Button } from "./ui/button";
import { Trash2, AlertCircle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";

interface DeleteRowButtonProps {
  tableName: string;
  primaryKeyValues: Record<string, string | number>;
}

export default function DeleteRowButton({
  tableName,
  primaryKeyValues,
}: DeleteRowButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent the default dialog close behavior
    setIsLoading(true);
    setError(null);
    try {
      await deleteTableRow(tableName, primaryKeyValues);
      setIsOpen(false); // Only close on success
      router.refresh();
    } catch (error) {
      console.error("Error deleting row:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete row. Please try again."
      );
      // Dialog stays open on error so user can see the error message
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Reset error state when dialog is closed
      setError(null);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 />
          <span className="sr-only">Delete row</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the row
            from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <Button
            onClick={handleDelete}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? "Deleting..." : "Delete"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

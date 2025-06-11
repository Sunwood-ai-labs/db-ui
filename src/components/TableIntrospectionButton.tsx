"use client";

import { useState } from "react";
import { Button } from "./ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./ui/sheet";
import { Info } from "lucide-react";
import TableIntrospectionContent from "./TableIntrospectionContent";

interface TableIntrospectionButtonProps {
  tableName: string;
  introspection: import("@/lib/types").TableIntrospection;
}

export default function TableIntrospectionButton({
  tableName,
  introspection,
}: TableIntrospectionButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="outline">
          <Info className="w-4 h-4 mr-2" />
          Schema
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[800px] sm:max-w-[800px]">
        <SheetHeader>
          <SheetTitle>Table Schema: {tableName}</SheetTitle>
        </SheetHeader>
        <TableIntrospectionContent data={introspection} />
      </SheetContent>
    </Sheet>
  );
}

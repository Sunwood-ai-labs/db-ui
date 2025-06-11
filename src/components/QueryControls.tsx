"use client";

import { Button } from "./ui/button";

interface QueryControlsProps {
  onClear: () => void;
}

export default function QueryControls({ onClear }: QueryControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Button size="sm" type="submit" variant="default">
        Run Query
      </Button>
      <Button size="sm" type="button" variant="outline" onClick={onClear}>
        Clear All
      </Button>
    </div>
  );
}

"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, Table, Code, Eye, MessageSquare } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import Fuse from "fuse.js";
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import Link from "next/link";

interface TableInfo {
  table_name: string;
  schema_name: string;
  full_table_name: string;
  table_type: string;
}

interface SearchableSidebarContentProps {
  tables: TableInfo[];
}

export default function SearchableSidebarContent({
  tables,
}: SearchableSidebarContentProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredTables, setFilteredTables] = useState(tables);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Initialize Fuse.js for fuzzy search using useMemo
  const fuse = useMemo(
    () =>
      new Fuse(tables, {
        keys: ["table_name", "schema_name", "full_table_name"],
        threshold: 0.3, // Lower threshold means more strict matching
        includeScore: true,
      }),
    [tables]
  );

  // Group tables by schema for display
  const groupedTables = useMemo(() => {
    const grouped: Record<string, TableInfo[]> = {};
    filteredTables.forEach((table) => {
      if (!grouped[table.schema_name]) {
        grouped[table.schema_name] = [];
      }
      grouped[table.schema_name].push(table);
    });
    return grouped;
  }, [filteredTables]);

  // Get the currently selected table
  const selectedTable = useMemo(() => {
    return filteredTables.length > 0 &&
      selectedIndex >= 0 &&
      selectedIndex < filteredTables.length
      ? filteredTables[selectedIndex]
      : null;
  }, [filteredTables, selectedIndex]);

  // Clear search when route changes
  useEffect(() => {
    setSearchQuery("");
    setSelectedIndex(0);
  }, [pathname]);

  // Handle search input changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTables(tables);
    } else {
      const results = fuse.search(searchQuery);
      setFilteredTables(results.map((result) => result.item));
    }
    // Reset selection when search changes
    setSelectedIndex(0);
  }, [searchQuery, tables, fuse]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K or Ctrl+K to focus search - this should work globally
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Only handle other keyboard shortcuts when search input is focused
      if (!isInputFocused) {
        return;
      }

      // Arrow key navigation
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prevIndex) => {
          const maxIndex = filteredTables.length - 1;
          return prevIndex < maxIndex ? prevIndex + 1 : 0; // Wrap to beginning
        });
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prevIndex) => {
          const maxIndex = filteredTables.length - 1;
          return prevIndex > 0 ? prevIndex - 1 : maxIndex; // Wrap to end
        });
        return;
      }

      // Enter key to navigate to selected result
      if (event.key === "Enter") {
        event.preventDefault();
        if (selectedTable) {
          router.push(`/${encodeURIComponent(selectedTable.full_table_name)}`);
        }
        searchInputRef.current?.blur();
        return;
      }

      // Escape to clear search and unfocus
      if (event.key === "Escape") {
        setSearchQuery("");
        setSelectedIndex(0);
        searchInputRef.current?.blur();
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredTables, selectedTable, router, isInputFocused]);

  return (
    <>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            {/* Search Input with Theme Switcher */}
            <div className="flex items-center gap-2 mb-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search (⌘K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  className="w-full pl-8 pr-2 py-1.5 text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                />
              </div>
              <ThemeSwitcher />
            </div>

            {/* Search hint when focused and has results */}
            {isInputFocused && filteredTables.length > 0 && (
              <div className="px-2 py-1 mb-2 text-xs text-muted-foreground bg-muted/50 rounded-md">
                {selectedTable ? (
                  <>
                    Press Enter to open &quot;{selectedTable.table_name}&quot; •
                    Use ↑↓ arrows to navigate
                  </>
                ) : (
                  "Use ↑↓ arrows to navigate, Enter to select"
                )}
              </div>
            )}

            {/* Tables List */}
            <SidebarMenu>
              {Object.keys(groupedTables).length === 0 &&
              searchQuery.trim() !== "" ? (
                <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No tables or views found
                </div>
              ) : (
                Object.entries(groupedTables).map(
                  ([schemaName, schemaTables]) => (
                    <div key={schemaName}>
                      <div className="px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {schemaName}
                      </div>
                      {schemaTables.map((table) => {
                        // Get the index of this table in the filtered results
                        const tableIndex = filteredTables.findIndex(
                          (t) => t.full_table_name === table.full_table_name
                        );
                        // Only highlight when input is focused or there's an active search
                        const isSelected =
                          (isInputFocused || searchQuery.trim() !== "") &&
                          tableIndex === selectedIndex;

                        return (
                          <SidebarMenuItem key={table.full_table_name}>
                            <SidebarMenuButton asChild>
                              <Link
                                href={`/${encodeURIComponent(
                                  table.full_table_name
                                )}`}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md ${
                                  isSelected
                                    ? "bg-accent/50 border border-accent-foreground/20 shadow-sm"
                                    : ""
                                }`}
                              >
                                {table.table_type === "VIEW" ? (
                                  <Eye className="w-4 h-4" />
                                ) : (
                                  <Table className="w-4 h-4" />
                                )}
                                <span>{table.table_name}</span>
                                <div className="ml-auto flex items-center gap-1">
                                  <span className="text-xs text-muted-foreground/60">
                                    {table.table_type === "VIEW"
                                      ? "view"
                                      : "table"}
                                  </span>
                                  {isSelected && (
                                    <span className="text-xs text-muted-foreground">
                                      ↵
                                    </span>
                                  )}
                                </div>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </div>
                  )
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link
                href="/sql"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
              >
                <Code className="w-4 h-4" />
                <span>Run SQL</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link
                href="/chat"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent rounded-md"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Chat with DB</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}

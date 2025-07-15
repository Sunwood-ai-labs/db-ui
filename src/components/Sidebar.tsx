import { getTables } from "@/lib/db";
import { Sidebar as ShadcnSidebar } from "@/components/ui/sidebar";
import SearchableSidebarContent from "./SearchableSidebar";

export default async function Sidebar() {
  const tables = await getTables();

  return (
    <ShadcnSidebar data-testid="sidebar">
      <SearchableSidebarContent tables={tables} />
    </ShadcnSidebar>
  );
}

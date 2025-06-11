import AddRowButton from "./AddRowButton";
import TableIntrospectionButton from "./TableIntrospectionButton";

interface TableHeaderProps {
  tableName: string;
  columns: string[];
  columnTypes: Record<string, { dataType: string; udtName: string }>;
  tableType?: string | null;
  introspection: import("@/lib/types").TableIntrospection;
}

export default function TableHeader({
  tableName,
  columns,
  columnTypes,
  tableType,
  introspection,
}: TableHeaderProps) {
  return (
    <div className="border-b">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex flex-row gap-2">
          <h2 className="text-xl font-semibold">{tableName}</h2>
        </div>
        <div className="flex flex-row gap-2">
          <TableIntrospectionButton
            tableName={tableName}
            introspection={introspection}
          />
          {tableType === "BASE TABLE" && (
            <AddRowButton
              tableName={tableName}
              columns={columns}
              columnTypes={columnTypes}
            />
          )}
        </div>
      </div>
    </div>
  );
}

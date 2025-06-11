"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Key, Link, Database } from "lucide-react";

import { TableIntrospection, IntrospectionColumn } from "@/lib/types";

interface TableIntrospectionContentProps {
  data: TableIntrospection;
}

export default function TableIntrospectionContent({
  data: introspection,
}: TableIntrospectionContentProps) {
  const formatDataType = (column: IntrospectionColumn) => {
    let type = column.data_type;

    if (column.character_maximum_length) {
      type += `(${column.character_maximum_length})`;
    } else if (column.numeric_precision && column.numeric_scale !== null) {
      type += `(${column.numeric_precision},${column.numeric_scale})`;
    } else if (column.numeric_precision) {
      type += `(${column.numeric_precision})`;
    }

    return type;
  };

  const isPrimaryKeyColumn = (columnName: string) => {
    return introspection.primaryKeys.some(
      (pk) => pk.column_name === columnName
    );
  };

  const getForeignKeyInfo = (columnName: string) => {
    return introspection.foreignKeys.find(
      (fk) => fk.column_name === columnName
    );
  };

  return (
    <div className="flex flex-col gap-6 p-4 pt-0 overflow-y-auto">
      {/* Columns Section */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Database className="w-5 h-5" />
          <h3 className="text-lg font-semibold">Columns</h3>
        </div>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Nullable</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Constraints</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {introspection.columns.map((column) => {
                const isPrimaryKey = isPrimaryKeyColumn(column.column_name);
                const foreignKey = getForeignKeyInfo(column.column_name);

                return (
                  <TableRow key={column.column_name}>
                    <TableCell className="font-medium">
                      {column.column_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {formatDataType(column)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          column.is_nullable === "YES" ? "secondary" : "outline"
                        }
                      >
                        {column.is_nullable === "YES" ? "NULL" : "NOT NULL"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {column.column_default ? (
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {column.column_default}
                        </code>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {isPrimaryKey && (
                          <Badge variant="default" className="text-xs">
                            <Key className="w-3 h-3 mr-1" />
                            PK
                          </Badge>
                        )}
                        {foreignKey && (
                          <Badge variant="outline" className="text-xs">
                            <Link className="w-3 h-3 mr-1" />
                            FK → {foreignKey.foreign_table_name}
                          </Badge>
                        )}
                        {column.is_identity === "YES" && (
                          <Badge variant="secondary" className="text-xs">
                            Identity
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Primary Keys Section */}
      {introspection.primaryKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Key className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Primary Key</h3>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>Position</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {introspection.primaryKeys.map((pk) => (
                  <TableRow key={pk.column_name}>
                    <TableCell className="font-medium">
                      {pk.column_name}
                    </TableCell>
                    <TableCell>{pk.ordinal_position}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Foreign Keys Section */}
      {introspection.foreignKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Link className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Foreign Keys</h3>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Column</TableHead>
                  <TableHead>References</TableHead>
                  <TableHead>On Update</TableHead>
                  <TableHead>On Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {introspection.foreignKeys.map((fk) => (
                  <TableRow key={fk.constraint_name}>
                    <TableCell className="font-medium">
                      {fk.column_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {fk.foreign_table_schema}.{fk.foreign_table_name}.
                        {fk.foreign_column_name}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {fk.update_rule}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {fk.delete_rule}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Indexes Section */}
      {introspection.indexes.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Database className="w-5 h-5" />
            <h3 className="text-lg font-semibold">Indexes</h3>
          </div>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Columns</TableHead>
                  <TableHead>Properties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {introspection.indexes.map((index) => (
                  <TableRow key={index.index_name}>
                    <TableCell className="font-medium">
                      {index.index_name}
                    </TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {index.index_type}
                      </code>
                    </TableCell>
                    <TableCell>
                      {Array.isArray(index.columns)
                        ? index.columns.join(", ")
                        : index.columns}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {index.is_unique && (
                          <Badge variant="secondary" className="text-xs">
                            Unique
                          </Badge>
                        )}
                        {index.is_primary && (
                          <Badge variant="default" className="text-xs">
                            Primary
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

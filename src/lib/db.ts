"use server";

import { getDatabaseConnection } from "./database/factory";
import { TableIntrospection } from "./types";
import {
  parseFiltersFromSearchParams,
  parseSortsFromSearchParams,
} from "./utils";

export async function getTables() {
  const db = await getDatabaseConnection();
  return db.getTables();
}

export async function getTableData(
  tableName: string,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>
) {
  const db = await getDatabaseConnection();

  // Convert searchParams to page and pageSize for the abstraction layer
  let page = 1;
  let pageSize = 10;

  if (searchParams) {
    let urlSearchParams: URLSearchParams;
    if (searchParams instanceof URLSearchParams) {
      urlSearchParams = searchParams;
    } else {
      urlSearchParams = new URLSearchParams();
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach((v) => urlSearchParams.append(key, v));
          } else {
            urlSearchParams.append(key, value);
          }
        }
      });
    }

    page = parseInt(urlSearchParams.get("page") || "1");
    pageSize = parseInt(urlSearchParams.get("pageSize") || "10");
  }

  // Parse filters and sorts from searchParams
  const filters = searchParams
    ? parseFiltersFromSearchParams(searchParams)
    : [];
  const sorts = searchParams ? parseSortsFromSearchParams(searchParams) : [];

  const result = await db.getTableData(
    tableName,
    page,
    pageSize,
    filters,
    sorts
  );

  // Convert back to the expected format
  return {
    rows: result.rows,
    totalCount: result.totalCount,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  };
}

export async function insertTableRow(
  tableName: string,
  data: Record<string, string | number | boolean | Date>
) {
  const db = await getDatabaseConnection();
  return db.insertTableRow(tableName, data);
}

export async function getTablePrimaryKeys(tableName: string) {
  const db = await getDatabaseConnection();
  return db.getTablePrimaryKeys(tableName);
}

export async function deleteTableRow(
  tableName: string,
  primaryKeyValues: Record<string, string | number>
) {
  const db = await getDatabaseConnection();
  return db.deleteTableRow(tableName, primaryKeyValues);
}

export async function updateTableRow(
  tableName: string,
  primaryKeyValues: Record<string, string | number>,
  data: Record<string, string | number | boolean | Date>
) {
  const db = await getDatabaseConnection();
  return db.updateTableRow(tableName, primaryKeyValues, data);
}

export async function getTableColumns(tableName: string) {
  const db = await getDatabaseConnection();
  return db.getTableColumns(tableName);
}

export async function getTableColumnTypes(tableName: string) {
  const db = await getDatabaseConnection();
  return db.getTableColumnTypes(tableName);
}

export async function getTableType(tableName: string) {
  const db = await getDatabaseConnection();
  return db.getTableType(tableName);
}

export async function executeQuery(sqlQuery: string) {
  const db = await getDatabaseConnection();
  return db.executeQuery(sqlQuery);
}

export async function getTableIntrospection(
  tableName: string
): Promise<TableIntrospection> {
  const db = await getDatabaseConnection();
  return db.getTableIntrospection(tableName);
}

export async function getFullDatabaseSchema() {
  const db = await getDatabaseConnection();
  return db.getFullDatabaseSchema();
}

export async function formatSchemaForAI(
  schemas: Awaited<ReturnType<typeof getFullDatabaseSchema>>
): Promise<string> {
  let schemaText = "Database Schema Information:\n\n";

  for (const table of schemas) {
    const tableType = table.table_type === "VIEW" ? "VIEW" : "TABLE";
    schemaText += `${tableType}: ${table.schema_name}.${table.table_name}\n`;
    schemaText += "Columns:\n";

    for (const column of table.columns) {
      const nullable = column.is_nullable === "YES" ? "NULL" : "NOT NULL";
      const defaultVal = column.column_default
        ? ` DEFAULT ${column.column_default}`
        : "";
      schemaText += `  - ${column.column_name}: ${column.data_type}${defaultVal} (${nullable})\n`;
    }

    schemaText += "\n";
  }

  return schemaText;
}

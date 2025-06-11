"use server";

import { Pool } from "pg";

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export interface TableSchema {
  table_name: string;
  schema_name: string;
  table_type: string;
  columns: ColumnInfo[];
}

// Create a connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
});

export async function getFullDatabaseSchema(): Promise<TableSchema[]> {
  const client = await pool.connect();
  try {
    // Get all tables and views
    const tablesResult = await client.query(`
      SELECT 
        table_schema as schema_name,
        table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_schema, table_type DESC, table_name;
    `);

    const tables = tablesResult.rows;
    const schemas: TableSchema[] = [];

    // Get columns for each table
    for (const table of tables) {
      const columnsResult = await client.query(
        `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length,
          numeric_precision,
          numeric_scale
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `,
        [table.schema_name, table.table_name]
      );

      schemas.push({
        table_name: table.table_name,
        schema_name: table.schema_name,
        table_type: table.table_type,
        columns: columnsResult.rows,
      });
    }

    return schemas;
  } finally {
    client.release();
  }
}

export async function formatSchemaForAI(
  schemas: TableSchema[]
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

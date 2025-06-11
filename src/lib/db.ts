"use server";

import pg, { Pool } from "pg";
import { TableIntrospection } from "./types";

pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIME, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMP, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMESTAMPTZ, (value) => value);
pg.types.setTypeParser(pg.types.builtins.INTERVAL, (value) => value);
pg.types.setTypeParser(pg.types.builtins.TIMETZ, (value) => value);
pg.types.setTypeParser(pg.types.builtins.JSONB, (value) => value);
pg.types.setTypeParser(pg.types.builtins.JSONB, (value) => value);

// Create a connection pool
const pool = new Pool({
  user: process.env.POSTGRES_USER,
  host: process.env.POSTGRES_HOST,
  database: process.env.POSTGRES_DB,
  password: process.env.POSTGRES_PASSWORD,
  port: parseInt(process.env.POSTGRES_PORT || "5432"),
});

export async function getTables() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        table_schema as schema_name,
        table_name,
        table_schema || '.' || table_name as full_table_name,
        table_type
      FROM information_schema.tables 
      WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
      AND table_type IN ('BASE TABLE', 'VIEW')
      ORDER BY table_schema, table_type DESC, table_name;
    `);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function getTableData(
  tableName: string,
  searchParams?: URLSearchParams | Record<string, string | string[] | undefined>
) {
  const client = await pool.connect();
  try {
    // Use fully qualified table name (schema.table or just table for public schema)
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `public.${tableName}`;

    let query = `SELECT * FROM ${fullyQualifiedName}`;
    const values: (string | number)[] = [];
    let paramIndex = 1;

    // Convert searchParams to URLSearchParams if it's not already
    let urlSearchParams: URLSearchParams | undefined;
    if (searchParams) {
      if (searchParams instanceof URLSearchParams) {
        urlSearchParams = searchParams;
      } else {
        urlSearchParams = new URLSearchParams();
        Object.entries(searchParams).forEach(([key, value]) => {
          if (value !== undefined) {
            if (Array.isArray(value)) {
              value.forEach((v) => urlSearchParams!.append(key, v));
            } else {
              urlSearchParams!.append(key, value);
            }
          }
        });
      }
    }

    if (urlSearchParams) {
      const conditions: string[] = [];

      urlSearchParams.forEach((value, key) => {
        // Parse filters[column_name]=operator
        const filterMatch = key.match(/^filters\[(.+)\]$/);
        if (filterMatch) {
          const column = filterMatch[1];

          // Skip empty values
          if (!value) return;

          // Parse operator from value (format: "operator:actual_value")
          const [operator, ...valueParts] = value.split(":");
          const actualValue = valueParts.join(":");

          if (operator === "LIKE" || operator === "NOT LIKE") {
            conditions.push(`"${column}" ${operator} $${paramIndex}`);
            values.push(`%${actualValue}%`);
          } else {
            conditions.push(`"${column}" ${operator} $${paramIndex}`);
            values.push(actualValue);
          }
          paramIndex++;
        }
      });

      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      // Handle sorting with bracket notation: sort[column_name]=direction
      const sorts: string[] = [];
      urlSearchParams.forEach((value, key) => {
        const sortMatch = key.match(/^sort\[(.+)\]$/);
        if (sortMatch) {
          const column = sortMatch[1];
          sorts.push(`"${column}" ${value}`);
        }
      });

      if (sorts.length > 0) {
        query += ` ORDER BY ${sorts.join(", ")}`;
      }
    }

    // Get total count for pagination
    let countQuery = query;

    // Remove ORDER BY clause from count query to avoid GROUP BY issues
    const orderByIndex = countQuery.indexOf(" ORDER BY ");
    if (orderByIndex !== -1) {
      countQuery = countQuery.substring(0, orderByIndex);
    }

    // Replace SELECT * with SELECT COUNT(*)
    countQuery = countQuery.replace("SELECT *", "SELECT COUNT(*)");

    let countResult;
    let totalCount = 0;

    try {
      countResult = await client.query(countQuery, values);
      totalCount = parseInt(countResult.rows[0].count);
    } catch (error) {
      // If count query fails, return the error
      return {
        error: `Database query failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        rows: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      };
    }

    // Handle pagination
    const page = parseInt(urlSearchParams?.get("page") || "1");
    const pageSize = parseInt(urlSearchParams?.get("pageSize") || "10");
    const offset = (page - 1) * pageSize;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    values.push(pageSize, offset);

    try {
      const result = await client.query(query, values);
      return {
        rows: result.rows,
        totalCount,
        page,
        pageSize,
        totalPages: Math.ceil(totalCount / pageSize),
      };
    } catch (error) {
      // If main query fails, return the error
      return {
        error: `Database query failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
      };
    }
  } finally {
    client.release();
  }
}

export async function insertTableRow(
  tableName: string,
  data: Record<string, string | number | boolean>
) {
  const client = await pool.connect();
  try {
    // Use fully qualified table name (schema.table or just table for public schema)
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `public.${tableName}`;

    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(", ");

    const query = `
      INSERT INTO ${fullyQualifiedName} (${columns
      .map((c) => `"${c}"`)
      .join(", ")})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await client.query(query, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getTablePrimaryKeys(tableName: string) {
  const client = await pool.connect();
  try {
    // Parse schema and table name for proper regclass construction
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `public.${tableName}`;

    const query = `
      SELECT a.attname as column_name
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass
      AND i.indisprimary;
    `;

    const result = await client.query(query, [fullyQualifiedName]);
    return result.rows.map((row) => row.column_name);
  } finally {
    client.release();
  }
}

export async function deleteTableRow(
  tableName: string,
  primaryKeyValues: Record<string, string | number>
) {
  const client = await pool.connect();
  try {
    // Use fully qualified table name (schema.table or just table for public schema)
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `public.${tableName}`;

    const conditions = Object.entries(primaryKeyValues)
      .map(([column], index) => `"${column}" = $${index + 1}`)
      .join(" AND ");

    const query = `
      DELETE FROM ${fullyQualifiedName}
      WHERE ${conditions}
      RETURNING *;
    `;

    const result = await client.query(query, Object.values(primaryKeyValues));
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function updateTableRow(
  tableName: string,
  primaryKeyValues: Record<string, string | number>,
  data: Record<string, string | number | boolean>
) {
  const client = await pool.connect();
  try {
    // Use fully qualified table name (schema.table or just table for public schema)
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `public.${tableName}`;

    // Build the SET clause for the UPDATE query
    const setClause = Object.entries(data)
      .map(([key], index) => `"${key}" = $${index + 1}`)
      .join(", ");

    // Build the WHERE clause using primary key columns
    const conditions = Object.entries(primaryKeyValues)
      .map(
        ([column], index) =>
          `"${column}" = $${Object.keys(data).length + index + 1}`
      )
      .join(" AND ");

    // Create the parameterized query
    const query = `
      UPDATE ${fullyQualifiedName}
      SET ${setClause}
      WHERE ${conditions}
      RETURNING *
    `;

    // Create the values array with all parameters (data values first, then primary key values)
    const values = [...Object.values(data), ...Object.values(primaryKeyValues)];

    const result = await client.query(query, values);
    return result.rows[0];
  } finally {
    client.release();
  }
}

export async function getTableColumns(tableName: string) {
  const client = await pool.connect();
  try {
    // Parse schema and table name
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : ["public", tableName];

    const query = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query, [schema, table]);
    return result.rows.map((row) => row.column_name);
  } finally {
    client.release();
  }
}

export async function getTableColumnTypes(tableName: string) {
  const client = await pool.connect();
  try {
    // Parse schema and table name
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : ["public", tableName];

    const query = `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query, [schema, table]);
    return result.rows.reduce((acc, row) => {
      acc[row.column_name] = {
        dataType: row.data_type,
        udtName: row.udt_name,
      };
      return acc;
    }, {} as Record<string, { dataType: string; udtName: string }>);
  } finally {
    client.release();
  }
}

export async function getTableType(tableName: string) {
  const client = await pool.connect();
  try {
    // Parse schema and table name
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : ["public", tableName];

    const query = `
      SELECT table_type
      FROM information_schema.tables
      WHERE table_schema = $1 AND table_name = $2;
    `;

    const result = await client.query(query, [schema, table]);
    return result.rows[0]?.table_type || null;
  } finally {
    client.release();
  }
}

export async function executeQuery(sqlQuery: string) {
  const client = await pool.connect();
  try {
    const result = await client.query(sqlQuery);
    return {
      success: true,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields ? result.fields.map((field) => field.name) : [],
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      rows: [],
      rowCount: 0,
      fields: [],
    };
  } finally {
    client.release();
  }
}

export async function getTableIntrospection(
  tableName: string
): Promise<TableIntrospection> {
  const client = await pool.connect();
  try {
    // Parse schema and table name
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : ["public", tableName];

    // Get detailed column information
    const columnsResult = await client.query(
      `
      SELECT 
        c.column_name,
        c.ordinal_position,
        c.column_default,
        c.is_nullable,
        c.data_type,
        c.udt_name,
        c.character_maximum_length,
        c.numeric_precision,
        c.numeric_scale,
        c.datetime_precision,
        c.is_identity,
        c.identity_generation,
        c.is_generated,
        c.generation_expression,
        col_description(pgc.oid, c.ordinal_position) as column_comment
      FROM information_schema.columns c
      LEFT JOIN pg_class pgc ON pgc.relname = c.table_name
      LEFT JOIN pg_namespace pgn ON pgn.oid = pgc.relnamespace AND pgn.nspname = c.table_schema
      WHERE c.table_schema = $1 AND c.table_name = $2
      ORDER BY c.ordinal_position;
    `,
      [schema, table]
    );

    // Get primary key information
    const primaryKeyResult = await client.query(
      `
      SELECT 
        kcu.column_name,
        kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name 
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = $1 
        AND tc.table_name = $2
      ORDER BY kcu.ordinal_position;
    `,
      [schema, table]
    );

    // Get foreign key information
    const foreignKeysResult = await client.query(
      `
      SELECT 
        kcu.column_name,
        ccu.table_schema AS foreign_table_schema,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        tc.constraint_name,
        rc.update_rule,
        rc.delete_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu 
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON tc.constraint_name = rc.constraint_name
        AND tc.table_schema = rc.constraint_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = $1 
        AND tc.table_name = $2;
    `,
      [schema, table]
    );

    // Get indexes information
    const indexesResult = await client.query(
      `
      SELECT 
        i.relname AS index_name,
        i.relname AS index_name,
        am.amname AS index_type,
        ix.indisunique AS is_unique,
        ix.indisprimary AS is_primary,
        array_agg(a.attname ORDER BY c.ordinality) AS columns
      FROM pg_class t
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_index ix ON t.oid = ix.indrelid
      JOIN pg_class i ON i.oid = ix.indexrelid
      JOIN pg_am am ON i.relam = am.oid
      JOIN unnest(ix.indkey) WITH ORDINALITY AS c(attnum, ordinality) ON true
      JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = c.attnum
      WHERE n.nspname = $1 AND t.relname = $2
      GROUP BY i.relname, am.amname, ix.indisunique, ix.indisprimary
      ORDER BY i.relname;
    `,
      [schema, table]
    );

    return {
      columns: columnsResult.rows,
      primaryKeys: primaryKeyResult.rows,
      foreignKeys: foreignKeysResult.rows,
      indexes: indexesResult.rows,
    };
  } finally {
    client.release();
  }
}

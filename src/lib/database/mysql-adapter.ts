import mysql from "mysql2/promise";
import {
  DatabaseAdapter,
  DatabaseConnection,
  DatabaseConfig,
  TableInfo,
  TableDataRow,
  QueryResult,
  TableDataResult,
  TableSchemaInfo,
} from "./index";
import { TableIntrospection, Filter, Sort } from "../types";

// MySQL-specific interfaces for query results
interface MySQLTableRow {
  schema_name: string;
  table_name: string;
  full_table_name: string;
  table_type: string;
}

interface MySQLCountResult {
  total: number;
}

interface MySQLInsertResult {
  insertId: number;
  affectedRows: number;
}

interface MySQLColumnInfo {
  column_name: string;
  data_type: string;
  column_type: string;
}

interface MySQLKeyColumnUsage {
  column_name: string;
}

interface MySQLForeignKeyInfo {
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface MySQLTableTypeResult {
  table_type: string;
}

interface MySQLFieldInfo {
  name: string;
}

interface MySQLIndexInfo {
  index_name: string;
  column_name: string;
  non_unique: number;
  index_type: string;
}

interface MySQLIntrospectionColumn {
  column_name: string;
  data_type: string;
  is_nullable: "YES" | "NO";
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  extra: string;
}

interface MySQLSchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
}

export class MySQLConnection implements DatabaseConnection {
  private connection: mysql.Connection;

  constructor(connection: mysql.Connection) {
    this.connection = connection;
  }

  async getTables(): Promise<TableInfo[]> {
    const [rows] = await this.connection.execute(`
      SELECT 
        TABLE_SCHEMA as schema_name,
        TABLE_NAME as table_name,
        CONCAT(TABLE_SCHEMA, '.', TABLE_NAME) as full_table_name,
        TABLE_TYPE as table_type
      FROM information_schema.tables 
      WHERE TABLE_SCHEMA NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
      AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
      ORDER BY TABLE_SCHEMA, TABLE_TYPE DESC, TABLE_NAME;
    `);

    return (rows as MySQLTableRow[]).map((row) => ({
      table_name: row.table_name,
      schema_name: row.schema_name,
      full_table_name: row.full_table_name,
      table_type: row.table_type,
    }));
  }

  async getTableData(
    tableName: string,
    page: number = 1,
    pageSize: number = 50,
    filters: Filter[] = [],
    sorts: Sort[] = []
  ): Promise<TableDataResult> {
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `\`${tableName}\``;

    const offset = (page - 1) * pageSize;

    // Build WHERE clause for filters
    let whereClause = "";
    const filterValues: (string | number | boolean)[] = [];

    if (filters.length > 0) {
      const filterConditions = filters.map((filter) => {
        let condition: string;
        switch (filter.operator) {
          case "=":
            condition = `\`${filter.column}\` = ?`;
            break;
          case "!=":
            condition = `\`${filter.column}\` != ?`;
            break;
          case ">":
            condition = `\`${filter.column}\` > ?`;
            break;
          case "<":
            condition = `\`${filter.column}\` < ?`;
            break;
          case ">=":
            condition = `\`${filter.column}\` >= ?`;
            break;
          case "<=":
            condition = `\`${filter.column}\` <= ?`;
            break;
          case "LIKE":
            condition = `\`${filter.column}\` LIKE ?`;
            break;
          case "NOT LIKE":
            condition = `\`${filter.column}\` NOT LIKE ?`;
            break;
          default:
            condition = `\`${filter.column}\` = ?`;
        }
        filterValues.push(filter.value);
        return condition;
      });
      whereClause = `WHERE ${filterConditions.join(" AND ")}`;
    }

    // Build ORDER BY clause for sorts
    let orderByClause = "";
    if (sorts.length > 0) {
      const sortConditions = sorts.map((sort) => {
        return `\`${sort.column}\` ${sort.direction.toUpperCase()}`;
      });
      orderByClause = `ORDER BY ${sortConditions.join(", ")}`;
    }

    // Get total count with filters
    const countQuery = `SELECT COUNT(*) as total FROM ${fullyQualifiedName} ${whereClause}`;
    const [countResult] = await this.connection.execute(countQuery, filterValues);
    const totalRows = (countResult as MySQLCountResult[])[0].total;

    // Get paginated data with filters, sorting, and pagination
    const dataQuery = `
      SELECT * FROM ${fullyQualifiedName} 
      ${whereClause} 
      ${orderByClause} 
      LIMIT ${pageSize} OFFSET ${offset}
    `;
    const [rows] = await this.connection.execute(dataQuery, filterValues);

    return {
      rows: this.convertRowsToStrings(rows as mysql.RowDataPacket[]),
      totalCount: totalRows,
      page,
      pageSize,
      totalPages: Math.ceil(totalRows / pageSize),
    };
  }

  async insertTableRow(
    tableName: string,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `\`${tableName}\``;

    const columns = Object.keys(data);
    const values = Object.values(data).map((value) => {
      // Convert Date objects to MySQL-compatible format
      if (value instanceof Date) {
        return value.toISOString().slice(0, 19).replace("T", " ");
      }
      // Convert ISO date strings to MySQL-compatible format
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        return new Date(value).toISOString().slice(0, 19).replace("T", " ");
      }
      // Convert boolean strings to 0/1 for MySQL
      if (typeof value === "string") {
        if (value.toLowerCase() === "true") {
          return 1;
        }
        if (value.toLowerCase() === "false") {
          return 0;
        }
      }
      return value;
    });
    const placeholders = values.map(() => "?").join(", ");

    const query = `
      INSERT INTO ${fullyQualifiedName} (${columns
      .map((c) => `\`${c}\``)
      .join(", ")})
      VALUES (${placeholders})
    `;

    const [result] = await this.connection.execute(query, values);
    const insertId = (result as MySQLInsertResult).insertId;

    // Get the inserted row
    const [rows] = await this.connection.execute(
      `SELECT * FROM ${fullyQualifiedName} WHERE id = ?`,
      [insertId]
    );

    return this.convertRowToStrings((rows as mysql.RowDataPacket[])[0]);
  }

  async updateTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `\`${tableName}\``;

    const setClause = Object.keys(data)
      .map((key) => `\`${key}\` = ?`)
      .join(", ");

    const whereClause = Object.keys(primaryKeyValues)
      .map((column) => `\`${column}\` = ?`)
      .join(" AND ");

    const query = `
      UPDATE ${fullyQualifiedName}
      SET ${setClause}
      WHERE ${whereClause}
    `;

    const processedDataValues = Object.values(data).map((value) => {
      // Convert Date objects to MySQL-compatible format
      if (value instanceof Date) {
        return value.toISOString().slice(0, 19).replace("T", " ");
      }
      // Convert ISO date strings to MySQL-compatible format
      if (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)
      ) {
        return new Date(value).toISOString().slice(0, 19).replace("T", " ");
      }
      // Convert boolean strings to 0/1 for MySQL
      if (typeof value === "string") {
        if (value.toLowerCase() === "true") {
          return 1;
        }
        if (value.toLowerCase() === "false") {
          return 0;
        }
      }
      return value;
    });

    const queryValues = [
      ...processedDataValues,
      ...Object.values(primaryKeyValues),
    ];

    await this.connection.execute(query, queryValues);

    // Get the updated row
    const selectQuery = `SELECT * FROM ${fullyQualifiedName} WHERE ${whereClause}`;
    const [rows] = await this.connection.execute(
      selectQuery,
      Object.values(primaryKeyValues)
    );

    return this.convertRowToStrings((rows as mysql.RowDataPacket[])[0]);
  }

  async deleteTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>
  ): Promise<TableDataRow> {
    const fullyQualifiedName = tableName.includes(".")
      ? tableName
      : `\`${tableName}\``;

    const whereClause = Object.keys(primaryKeyValues)
      .map((column) => `\`${column}\` = ?`)
      .join(" AND ");

    // Get the row before deleting
    const selectQuery = `SELECT * FROM ${fullyQualifiedName} WHERE ${whereClause}`;
    const [rows] = await this.connection.execute(
      selectQuery,
      Object.values(primaryKeyValues)
    );
    const rowToDelete = this.convertRowToStrings(
      (rows as mysql.RowDataPacket[])[0]
    );

    // Delete the row
    const deleteQuery = `DELETE FROM ${fullyQualifiedName} WHERE ${whereClause}`;
    await this.connection.execute(deleteQuery, Object.values(primaryKeyValues));

    return rowToDelete;
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : [null, tableName];

    let query = `
      SELECT COLUMN_NAME as column_name
      FROM information_schema.columns
      WHERE TABLE_NAME = ?
    `;
    const params: (string | null)[] = [table];

    if (schema) {
      query += ` AND TABLE_SCHEMA = ?`;
      params.push(schema);
    }

    query += ` ORDER BY ORDINAL_POSITION`;

    const [rows] = await this.connection.execute(query, params);
    return (rows as MySQLKeyColumnUsage[]).map((row) => row.column_name);
  }

  async getTableColumnTypes(
    tableName: string
  ): Promise<Record<string, { dataType: string; udtName: string }>> {
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : [null, tableName];

    let query = `
      SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        COLUMN_TYPE as column_type
      FROM information_schema.columns
      WHERE TABLE_NAME = ?
    `;
    const params: (string | null)[] = [table];

    if (schema) {
      query += ` AND TABLE_SCHEMA = ?`;
      params.push(schema);
    }

    const [rows] = await this.connection.execute(query, params);
    const result: Record<string, { dataType: string; udtName: string }> = {};

    for (const row of rows as MySQLColumnInfo[]) {
      result[row.column_name] = {
        dataType: row.data_type,
        udtName: row.column_type,
      };
    }

    return result;
  }

  async getTablePrimaryKeys(tableName: string): Promise<string[]> {
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : [null, tableName];

    let query = `
      SELECT COLUMN_NAME as column_name
      FROM information_schema.key_column_usage
      WHERE CONSTRAINT_NAME = 'PRIMARY'
      AND TABLE_NAME = ?
    `;
    const params: (string | null)[] = [table];

    if (schema) {
      query += ` AND TABLE_SCHEMA = ?`;
      params.push(schema);
    }

    query += ` ORDER BY ORDINAL_POSITION`;

    const [rows] = await this.connection.execute(query, params);
    return (rows as MySQLKeyColumnUsage[]).map((row) => row.column_name);
  }

  async getTableType(tableName: string): Promise<string | null> {
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : [null, tableName];

    let query = `
      SELECT TABLE_TYPE as table_type
      FROM information_schema.tables
      WHERE TABLE_NAME = ?
    `;
    const params: (string | null)[] = [table];

    if (schema) {
      query += ` AND TABLE_SCHEMA = ?`;
      params.push(schema);
    }

    const [rows] = await this.connection.execute(query, params);
    const rowsArray = rows as MySQLTableTypeResult[];
    return rowsArray.length > 0 ? rowsArray[0].table_type : null;
  }

  async executeQuery(sqlQuery: string): Promise<QueryResult> {
    try {
      const [rows, fields] = await this.connection.execute(sqlQuery);

      return {
        success: true,
        rows: this.convertRowsToStrings(rows as mysql.RowDataPacket[]),
        rowCount: Array.isArray(rows) ? rows.length : 0,
        fields: Array.isArray(fields)
          ? fields.map((field: MySQLFieldInfo) => field.name)
          : [],
      };
    } catch (error) {
      return {
        success: false,
        rows: [],
        rowCount: 0,
        fields: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getTableIntrospection(tableName: string): Promise<TableIntrospection> {
    const [schema, table] = tableName.includes(".")
      ? tableName.split(".", 2)
      : [null, tableName];

    // Get columns
    let columnsQuery = `
      SELECT 
        COLUMN_NAME as column_name,
        DATA_TYPE as data_type,
        IS_NULLABLE as is_nullable,
        COLUMN_DEFAULT as column_default,
        CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
        NUMERIC_PRECISION as numeric_precision,
        NUMERIC_SCALE as numeric_scale,
        EXTRA as extra
      FROM information_schema.columns
      WHERE TABLE_NAME = ?
    `;
    const columnsParams: (string | null)[] = [table];

    if (schema) {
      columnsQuery += ` AND TABLE_SCHEMA = ?`;
      columnsParams.push(schema);
    }

    columnsQuery += ` ORDER BY ORDINAL_POSITION`;

    const [columnsResult] = await this.connection.execute(
      columnsQuery,
      columnsParams
    );

    // Get primary keys
    let primaryKeysQuery = `
      SELECT COLUMN_NAME as column_name
      FROM information_schema.key_column_usage
      WHERE CONSTRAINT_NAME = 'PRIMARY'
      AND TABLE_NAME = ?
    `;
    const primaryKeysParams: (string | null)[] = [table];

    if (schema) {
      primaryKeysQuery += ` AND TABLE_SCHEMA = ?`;
      primaryKeysParams.push(schema);
    }

    const [primaryKeysResult] = await this.connection.execute(
      primaryKeysQuery,
      primaryKeysParams
    );

    // Get foreign keys
    let foreignKeysQuery = `
      SELECT 
        COLUMN_NAME as column_name,
        REFERENCED_TABLE_NAME as foreign_table_name,
        REFERENCED_COLUMN_NAME as foreign_column_name
      FROM information_schema.key_column_usage
      WHERE REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_NAME = ?
    `;
    const foreignKeysParams: (string | null)[] = [table];

    if (schema) {
      foreignKeysQuery += ` AND TABLE_SCHEMA = ?`;
      foreignKeysParams.push(schema);
    }

    const [foreignKeysResult] = await this.connection.execute(
      foreignKeysQuery,
      foreignKeysParams
    );

    // Get indexes
    let indexesQuery = `
      SELECT 
        INDEX_NAME as index_name,
        COLUMN_NAME as column_name,
        NON_UNIQUE as non_unique,
        INDEX_TYPE as index_type
      FROM information_schema.statistics
      WHERE TABLE_NAME = ?
    `;
    const indexesParams: (string | null)[] = [table];

    if (schema) {
      indexesQuery += ` AND TABLE_SCHEMA = ?`;
      indexesParams.push(schema);
    }

    indexesQuery += ` ORDER BY INDEX_NAME, SEQ_IN_INDEX`;

    const [indexesResult] = await this.connection.execute(
      indexesQuery,
      indexesParams
    );

    // Group indexes by name
    const indexMap = new Map<
      string,
      {
        index_name: string;
        index_type: string;
        is_unique: boolean;
        is_primary: boolean;
        columns: string[];
      }
    >();
    for (const row of indexesResult as MySQLIndexInfo[]) {
      if (!indexMap.has(row.index_name)) {
        indexMap.set(row.index_name, {
          index_name: row.index_name,
          index_type: row.index_type,
          is_unique: row.non_unique === 0,
          is_primary: row.index_name === "PRIMARY",
          columns: [],
        });
      }
      indexMap.get(row.index_name)!.columns.push(row.column_name);
    }

    return {
      columns: (columnsResult as MySQLIntrospectionColumn[]).map(
        (row, index) => ({
          column_name: row.column_name,
          data_type: row.data_type,
          is_nullable: row.is_nullable,
          column_default: row.column_default,
          character_maximum_length: row.character_maximum_length,
          numeric_precision: row.numeric_precision,
          numeric_scale: row.numeric_scale,
          ordinal_position: index + 1,
          udt_name: row.data_type,
          datetime_precision: null,
          identity_generation: row.extra === "auto_increment" ? "ALWAYS" : null,
          identity_start: null,
          identity_increment: null,
          is_identity: row.extra === "auto_increment" ? "YES" : "NO",
          is_generated: "NEVER",
          generation_expression: null,
          column_comment: "",
        })
      ),
      primaryKeys: (primaryKeysResult as MySQLKeyColumnUsage[]).map(
        (row, index) => ({
          column_name: row.column_name,
          ordinal_position: index + 1,
        })
      ),
      foreignKeys: (foreignKeysResult as MySQLForeignKeyInfo[]).map((row) => ({
        column_name: row.column_name,
        foreign_table_name: row.foreign_table_name,
        foreign_column_name: row.foreign_column_name,
        foreign_table_schema: "testdb",
        constraint_name: `fk_${row.column_name}`,
        update_rule: "NO ACTION",
        delete_rule: "NO ACTION",
      })),
      indexes: Array.from(indexMap.values()),
    };
  }

  async getFullDatabaseSchema(): Promise<TableSchemaInfo[]> {
    const tables = await this.getTables();
    const schemas: TableSchemaInfo[] = [];

    for (const table of tables) {
      // Get columns for each table
      const [columnsResult] = await this.connection.execute(
        `
        SELECT 
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          IS_NULLABLE as is_nullable,
          COLUMN_DEFAULT as column_default,
          CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
          NUMERIC_PRECISION as numeric_precision,
          NUMERIC_SCALE as numeric_scale
        FROM information_schema.columns
        WHERE TABLE_NAME = ? AND TABLE_SCHEMA = ?
        ORDER BY ORDINAL_POSITION
      `,
        [table.table_name, table.schema_name]
      );

      schemas.push({
        table_name: table.table_name,
        schema_name: table.schema_name,
        table_type: table.table_type,
        columns: (columnsResult as MySQLSchemaColumn[]).map((col) => ({
          column_name: col.column_name,
          data_type: col.data_type,
          is_nullable: col.is_nullable,
          column_default: col.column_default,
          character_maximum_length: col.character_maximum_length,
          numeric_precision: col.numeric_precision,
          numeric_scale: col.numeric_scale,
        })),
      });
    }

    return schemas;
  }

  async disconnect(): Promise<void> {
    await this.connection.end();
  }

  private convertRowsToStrings(rows: mysql.RowDataPacket[]): TableDataRow[] {
    return rows.map((row) => this.convertRowToStrings(row));
  }

  private convertRowToStrings(row: mysql.RowDataPacket): TableDataRow {
    const result: TableDataRow = {};
    for (const [key, value] of Object.entries(row)) {
      if (value === null) {
        result[key] = "";
      } else if (typeof value === "boolean") {
        result[key] = value ? "true" : "false";
      } else if (value instanceof Date) {
        result[key] = value.toISOString();
      } else if (typeof value === "number") {
        result[key] = String(value); // Convert to string for consistency
      } else if (typeof value === "object") {
        // Handle JSON objects by serializing them to JSON strings
        result[key] = JSON.stringify(value);
      } else {
        result[key] = String(value);
      }
    }
    return result;
  }
}

export class MySQLAdapter implements DatabaseAdapter {
  async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    const connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
    });

    return new MySQLConnection(connection);
  }
}

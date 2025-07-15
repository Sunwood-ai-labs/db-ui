import { ConnectionPool } from "mssql";
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

export class MSSQLConnection implements DatabaseConnection {
  private pool: ConnectionPool;

  constructor(config: DatabaseConfig) {
    this.pool = new ConnectionPool({
      server: config.host,
      port: config.port,
      database: config.database,
      user: config.username,
      password: config.password,
      options: {
        trustServerCertificate: true,
      },
    });
  }

  private async ensureConnected() {
    if (!this.pool.connected) {
      await this.pool.connect();
    }
  }

  async getTables(): Promise<TableInfo[]> {
    await this.ensureConnected();
    try {
      const result = await this.pool.request().query(`
        SELECT 
          TABLE_SCHEMA as schema_name,
          TABLE_NAME as table_name,
          TABLE_SCHEMA + '.' + TABLE_NAME as full_table_name,
          TABLE_TYPE as table_type
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
        AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ORDER BY TABLE_SCHEMA, TABLE_TYPE DESC, TABLE_NAME;
      `);
      return result.recordset;
    } catch (error) {
      throw error;
    }
  }

  async getTableData(
    tableName: string,
    page: number = 1,
    pageSize: number = 50,
    filters: Filter[] = [],
    sorts: Sort[] = []
  ): Promise<TableDataResult> {
    await this.ensureConnected();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `dbo.${tableName}`;

      const offset = (page - 1) * pageSize;

      // Build WHERE clause for filters
      let whereClause = "";
      const request = this.pool.request();
      let paramIndex = 1;

      if (filters.length > 0) {
        const filterConditions = filters.map((filter) => {
          let condition: string;
          switch (filter.operator) {
            case "=":
              condition = `[${filter.column}] = @param${paramIndex}`;
              break;
            case "!=":
              condition = `[${filter.column}] != @param${paramIndex}`;
              break;
            case ">":
              condition = `[${filter.column}] > @param${paramIndex}`;
              break;
            case "<":
              condition = `[${filter.column}] < @param${paramIndex}`;
              break;
            case ">=":
              condition = `[${filter.column}] >= @param${paramIndex}`;
              break;
            case "<=":
              condition = `[${filter.column}] <= @param${paramIndex}`;
              break;
            case "LIKE":
              condition = `[${filter.column}] LIKE @param${paramIndex}`;
              break;
            case "NOT LIKE":
              condition = `[${filter.column}] NOT LIKE @param${paramIndex}`;
              break;
            default:
              condition = `[${filter.column}] = @param${paramIndex}`;
          }
          request.input(`param${paramIndex}`, filter.value);
          paramIndex++;
          return condition;
        });
        whereClause = `WHERE ${filterConditions.join(" AND ")}`;
      }

      // Build ORDER BY clause for sorts
      let orderByClause = "ORDER BY (SELECT NULL)";
      if (sorts.length > 0) {
        const sortConditions = sorts.map((sort) => {
          return `[${sort.column}] ${sort.direction.toUpperCase()}`;
        });
        orderByClause = `ORDER BY ${sortConditions.join(", ")}`;
      }

      // Get total count with filters
      const countQuery = `SELECT COUNT(*) as total FROM ${fullyQualifiedName} ${whereClause}`;
      const countResult = await request.query(countQuery);
      const totalRows = parseInt(countResult.recordset[0].total);

      // Get paginated data with filters, sorting, and pagination
      const dataQuery = `
        SELECT * FROM ${fullyQualifiedName} 
        ${whereClause} 
        ${orderByClause} 
        OFFSET ${offset} ROWS FETCH NEXT ${pageSize} ROWS ONLY
      `;
      const result = await request.query(dataQuery);

      return {
        rows: this.convertRowsToStrings(result.recordset),
        totalCount: totalRows,
        page,
        pageSize,
        totalPages: Math.ceil(totalRows / pageSize),
      };
    } catch (error) {
      throw error;
    }
  }

  async insertTableRow(
    tableName: string,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    await this.ensureConnected();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `dbo.${tableName}`;

      // Get column types to handle date conversions properly
      const columnTypes = await this.getTableColumnTypes(tableName);
      const columns = Object.keys(data);
      const values = Object.values(data);

      const request = this.pool.request();
      const placeholders = values.map((_, i) => `@param${i}`).join(", ");

      // Add parameters to the request with date processing
      columns.forEach((column, i) => {
        const value = values[i];
        let processedValue = value;

        // Handle date/time conversions for MSSQL only for actual datetime columns
        if (typeof value === "string" && columnTypes[column]) {
          const columnType = columnTypes[column].dataType.toLowerCase();

          // Only attempt date conversion for actual datetime columns
          if (
            columnType.includes("datetime") ||
            columnType.includes("date") ||
            columnType.includes("time")
          ) {
            if (this.isDateString(value)) {
              try {
                // Convert to proper Date object for MSSQL
                processedValue = new Date(value);
              } catch {
                processedValue = value;
              }
            }
          }
        }

        request.input(`param${i}`, processedValue);
      });

      const query = `
        INSERT INTO ${fullyQualifiedName} ([${columns.join("], [")}])
        OUTPUT INSERTED.*
        VALUES (${placeholders});
      `;

      const result = await request.query(query);
      return this.convertRowToStrings(result.recordset[0]);
    } catch (error) {
      throw error;
    }
  }

  async updateTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>,
    data: Record<string, string | number | boolean | Date>
  ): Promise<TableDataRow> {
    await this.ensureConnected();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `dbo.${tableName}`;

      // Get column types to handle date conversions properly
      const columnTypes = await this.getTableColumnTypes(tableName);

      const request = this.pool.request();
      let paramIndex = 0;

      // Process data values to handle date conversions
      const processedData = Object.entries(data).map(([key, value]) => {
        let processedValue = value;

        // Handle date/time conversions for MSSQL only for actual datetime columns
        if (typeof value === "string" && columnTypes[key]) {
          const columnType = columnTypes[key].dataType.toLowerCase();

          // Only attempt date conversion for actual datetime columns
          if (
            columnType.includes("datetime") ||
            columnType.includes("date") ||
            columnType.includes("time")
          ) {
            if (this.isDateString(value)) {
              try {
                // Convert to proper Date object for MSSQL
                processedValue = new Date(value);
              } catch {
                processedValue = value;
              }
            }
          }
        }

        request.input(`data${paramIndex}`, processedValue);
        return `[${key}] = @data${paramIndex++}`;
      });

      const setClause = processedData.join(", ");

      const conditions = Object.entries(primaryKeyValues)
        .map(([column, value]) => {
          request.input(`pk${paramIndex}`, value);
          return `[${column}] = @pk${paramIndex++}`;
        })
        .join(" AND ");

      // Update the row (without OUTPUT clause to avoid trigger conflicts)
      const updateQuery = `
        UPDATE ${fullyQualifiedName}
        SET ${setClause}
        WHERE ${conditions}
      `;

      await request.query(updateQuery);

      // Then select the updated row
      const selectRequest = this.pool.request();
      let selectParamIndex = 0;
      const selectConditions = Object.entries(primaryKeyValues)
        .map(([column, value]) => {
          selectRequest.input(`pk${selectParamIndex}`, value);
          return `[${column}] = @pk${selectParamIndex++}`;
        })
        .join(" AND ");

      const selectQuery = `
        SELECT * FROM ${fullyQualifiedName}
        WHERE ${selectConditions}
      `;

      const selectResult = await selectRequest.query(selectQuery);
      return this.convertRowToStrings(selectResult.recordset[0]);
    } catch (error) {
      throw error;
    }
  }

  // Helper method to detect if a string looks like a date
  private isDateString(value: string): boolean {
    // Return false for empty strings or very short strings
    if (!value || value.trim().length < 8) {
      return false;
    }

    // Check for common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // SQL format
      /^\d{4}-\d{2}-\d{2}$/, // Date only
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
    ];

    // Must match a pattern AND be parseable as a valid date
    if (!datePatterns.some((pattern) => pattern.test(value))) {
      return false;
    }

    const parsed = Date.parse(value);
    return !isNaN(parsed) && parsed > 0;
  }

  async deleteTableRow(
    tableName: string,
    primaryKeyValues: Record<string, string | number>
  ): Promise<TableDataRow> {
    await this.ensureConnected();
    try {
      const fullyQualifiedName = tableName.includes(".")
        ? tableName
        : `dbo.${tableName}`;

      // First, get the row before deleting (since we can't use OUTPUT with triggers)
      const selectRequest = this.pool.request();
      let selectParamIndex = 0;
      const selectConditions = Object.entries(primaryKeyValues)
        .map(([column, value]) => {
          selectRequest.input(`select_pk${selectParamIndex}`, value);
          return `[${column}] = @select_pk${selectParamIndex++}`;
        })
        .join(" AND ");

      const selectQuery = `
        SELECT * FROM ${fullyQualifiedName}
        WHERE ${selectConditions}
      `;

      const selectResult = await selectRequest.query(selectQuery);
      const rowToDelete = this.convertRowToStrings(selectResult.recordset[0]);

      // Then delete the row
      const deleteRequest = this.pool.request();
      let deleteParamIndex = 0;
      const deleteConditions = Object.entries(primaryKeyValues)
        .map(([column, value]) => {
          deleteRequest.input(`delete_pk${deleteParamIndex}`, value);
          return `[${column}] = @delete_pk${deleteParamIndex++}`;
        })
        .join(" AND ");

      const deleteQuery = `
        DELETE FROM ${fullyQualifiedName}
        WHERE ${deleteConditions}
      `;

      await deleteRequest.query(deleteQuery);
      return rowToDelete;
    } catch (error) {
      throw error;
    }
  }

  async getTableColumns(tableName: string): Promise<string[]> {
    await this.ensureConnected();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["dbo", tableName];

      const query = `
        SELECT COLUMN_NAME as column_name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
        ORDER BY ORDINAL_POSITION;
      `;

      const request = this.pool.request();
      request.input("schema", schema);
      request.input("table", table);

      const result = await request.query(query);
      return result.recordset.map((row) => row.column_name);
    } catch (error) {
      throw error;
    }
  }

  async getTableColumnTypes(
    tableName: string
  ): Promise<Record<string, { dataType: string; udtName: string }>> {
    await this.ensureConnected();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["dbo", tableName];

      // Get column information
      const columnsQuery = `
        SELECT COLUMN_NAME as column_name, DATA_TYPE as data_type, DATA_TYPE as udt_name
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table
        ORDER BY ORDINAL_POSITION;
      `;

      const columnsRequest = this.pool.request();
      columnsRequest.input("schema", schema);
      columnsRequest.input("table", table);
      const columnsResult = await columnsRequest.query(columnsQuery);

      // Get JSON constraints information
      const jsonConstraintsQuery = `
        SELECT 
          ccu.COLUMN_NAME as column_name
        FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu 
          ON cc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
        WHERE cc.CHECK_CLAUSE LIKE '%ISJSON%'
          AND ccu.TABLE_SCHEMA = @schema 
          AND ccu.TABLE_NAME = @table;
      `;

      const jsonConstraintsRequest = this.pool.request();
      jsonConstraintsRequest.input("schema", schema);
      jsonConstraintsRequest.input("table", table);
      const jsonConstraintsResult = await jsonConstraintsRequest.query(
        jsonConstraintsQuery
      );

      // Create a set of JSON column names for quick lookup
      const jsonColumns = new Set(
        jsonConstraintsResult.recordset.map(
          (row: { column_name: string }) => row.column_name
        )
      );

      return columnsResult.recordset.reduce((acc, row) => {
        acc[row.column_name] = {
          dataType: row.data_type,
          // Mark columns with JSON constraints as JSON type
          udtName: jsonColumns.has(row.column_name) ? "json" : row.udt_name,
        };
        return acc;
      }, {} as Record<string, { dataType: string; udtName: string }>);
    } catch (error) {
      throw error;
    }
  }

  async getTablePrimaryKeys(tableName: string): Promise<string[]> {
    await this.ensureConnected();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["dbo", tableName];

      const query = `
        SELECT c.COLUMN_NAME as column_name
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.CONSTRAINT_COLUMN_USAGE ccu ON tc.CONSTRAINT_NAME = ccu.CONSTRAINT_NAME
        JOIN INFORMATION_SCHEMA.COLUMNS c ON ccu.COLUMN_NAME = c.COLUMN_NAME AND ccu.TABLE_NAME = c.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        AND tc.TABLE_SCHEMA = @schema 
        AND tc.TABLE_NAME = @table;
      `;

      const request = this.pool.request();
      request.input("schema", schema);
      request.input("table", table);

      const result = await request.query(query);
      return result.recordset.map((row) => row.column_name);
    } catch (error) {
      throw error;
    }
  }

  async getTableType(tableName: string): Promise<string | null> {
    await this.ensureConnected();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["dbo", tableName];

      const query = `
        SELECT TABLE_TYPE as table_type
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table;
      `;

      const request = this.pool.request();
      request.input("schema", schema);
      request.input("table", table);

      const result = await request.query(query);
      return result.recordset[0]?.table_type || null;
    } catch (error) {
      throw error;
    }
  }

  async executeQuery(sqlQuery: string): Promise<QueryResult> {
    await this.ensureConnected();
    try {
      const result = await this.pool.request().query(sqlQuery);
      return {
        success: true,
        rows: this.convertRowsToStrings(result.recordset),
        rowCount: result.rowsAffected ? result.rowsAffected[0] || 0 : 0,
        fields: Object.keys(result.recordset[0] || {}),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        rows: [],
        rowCount: 0,
        fields: [],
      };
    }
  }

  async getTableIntrospection(tableName: string): Promise<TableIntrospection> {
    await this.ensureConnected();
    try {
      const [schema, table] = tableName.includes(".")
        ? tableName.split(".", 2)
        : ["dbo", tableName];

      // Get detailed column information
      const columnsQuery = `
        SELECT 
          c.COLUMN_NAME as column_name,
          c.ORDINAL_POSITION as ordinal_position,
          c.COLUMN_DEFAULT as column_default,
          c.IS_NULLABLE as is_nullable,
          c.DATA_TYPE as data_type,
          c.DATA_TYPE as udt_name,
          c.CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
          c.NUMERIC_PRECISION as numeric_precision,
          c.NUMERIC_SCALE as numeric_scale,
          c.DATETIME_PRECISION as datetime_precision,
          CASE WHEN c.COLUMN_NAME IN (
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table 
            AND COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA+'.'+TABLE_NAME), COLUMN_NAME, 'IsIdentity') = 1
          ) THEN 'YES' ELSE 'NO' END as is_identity,
          CASE WHEN c.COLUMN_NAME IN (
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @table 
            AND COLUMNPROPERTY(OBJECT_ID(TABLE_SCHEMA+'.'+TABLE_NAME), COLUMN_NAME, 'IsIdentity') = 1
          ) THEN 'ALWAYS' ELSE NULL END as identity_generation,
          'NEVER' as is_generated,
          NULL as generation_expression,
          NULL as column_comment
        FROM INFORMATION_SCHEMA.COLUMNS c
        WHERE c.TABLE_SCHEMA = @schema AND c.TABLE_NAME = @table
        ORDER BY c.ORDINAL_POSITION;
      `;

      const columnsRequest = this.pool.request();
      columnsRequest.input("schema", schema);
      columnsRequest.input("table", table);
      const columnsResult = await columnsRequest.query(columnsQuery);

      // Get primary key information
      const primaryKeyQuery = `
        SELECT 
          kcu.COLUMN_NAME as column_name,
          kcu.ORDINAL_POSITION as ordinal_position
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu 
          ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME 
          AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
          AND tc.TABLE_SCHEMA = @schema 
          AND tc.TABLE_NAME = @table
        ORDER BY kcu.ORDINAL_POSITION;
      `;

      const primaryKeyRequest = this.pool.request();
      primaryKeyRequest.input("schema", schema);
      primaryKeyRequest.input("table", table);
      const primaryKeyResult = await primaryKeyRequest.query(primaryKeyQuery);

      // Get foreign key information
      const foreignKeysQuery = `
        SELECT 
          kcu1.COLUMN_NAME as column_name,
          kcu2.TABLE_SCHEMA as foreign_table_schema,
          kcu2.TABLE_NAME as foreign_table_name,
          kcu2.COLUMN_NAME as foreign_column_name,
          rc.CONSTRAINT_NAME as constraint_name,
          rc.UPDATE_RULE as update_rule,
          rc.DELETE_RULE as delete_rule
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu1 
          ON rc.CONSTRAINT_NAME = kcu1.CONSTRAINT_NAME
          AND rc.CONSTRAINT_SCHEMA = kcu1.TABLE_SCHEMA
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu2 
          ON rc.UNIQUE_CONSTRAINT_NAME = kcu2.CONSTRAINT_NAME
          AND rc.UNIQUE_CONSTRAINT_SCHEMA = kcu2.TABLE_SCHEMA
        WHERE kcu1.TABLE_SCHEMA = @schema 
          AND kcu1.TABLE_NAME = @table;
      `;

      const foreignKeysRequest = this.pool.request();
      foreignKeysRequest.input("schema", schema);
      foreignKeysRequest.input("table", table);
      const foreignKeysResult = await foreignKeysRequest.query(
        foreignKeysQuery
      );

      // Get indexes information
      const indexesQuery = `
        SELECT 
          i.name AS index_name,
          t.name AS index_type,
          i.is_unique AS is_unique,
          i.is_primary_key AS is_primary,
          STRING_AGG(c.name, ',') AS columns
        FROM sys.indexes i
        JOIN sys.tables ta ON i.object_id = ta.object_id
        JOIN sys.schemas s ON ta.schema_id = s.schema_id
        JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        JOIN sys.types t ON i.type = t.user_type_id
        WHERE s.name = @schema AND ta.name = @table
        GROUP BY i.name, t.name, i.is_unique, i.is_primary_key
        ORDER BY i.name;
      `;

      const indexesRequest = this.pool.request();
      indexesRequest.input("schema", schema);
      indexesRequest.input("table", table);
      const indexesResult = await indexesRequest.query(indexesQuery);

      return {
        columns: columnsResult.recordset,
        primaryKeys: primaryKeyResult.recordset,
        foreignKeys: foreignKeysResult.recordset,
        indexes: indexesResult.recordset.map(
          (row: {
            index_name: string;
            index_type: string;
            is_unique: boolean;
            is_primary: boolean;
            columns: string | string[];
          }) => ({
            index_name: row.index_name,
            index_type: row.index_type,
            is_unique: row.is_unique,
            is_primary: row.is_primary,
            columns:
              typeof row.columns === "string" ? row.columns.split(",") : [],
          })
        ),
      };
    } catch (error) {
      throw error;
    }
  }

  async getFullDatabaseSchema(): Promise<TableSchemaInfo[]> {
    await this.ensureConnected();
    try {
      // Get all tables and views
      const tablesResult = await this.pool.request().query(`
        SELECT 
          TABLE_SCHEMA as schema_name,
          TABLE_NAME as table_name,
          TABLE_TYPE as table_type
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA NOT IN ('INFORMATION_SCHEMA', 'sys', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
        AND TABLE_TYPE IN ('BASE TABLE', 'VIEW')
        ORDER BY TABLE_SCHEMA, TABLE_TYPE DESC, TABLE_NAME;
      `);

      const tables = tablesResult.recordset;
      const schemas: TableSchemaInfo[] = [];

      // Get columns for each table
      for (const table of tables) {
        const columnsRequest = this.pool.request();
        columnsRequest.input("schema", table.schema_name);
        columnsRequest.input("tableName", table.table_name);

        const columnsResult = await columnsRequest.query(`
          SELECT 
            COLUMN_NAME as column_name,
            DATA_TYPE as data_type,
            IS_NULLABLE as is_nullable,
            COLUMN_DEFAULT as column_default,
            CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
            NUMERIC_PRECISION as numeric_precision,
            NUMERIC_SCALE as numeric_scale
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @tableName
          ORDER BY ORDINAL_POSITION;
        `);

        schemas.push({
          table_name: table.table_name,
          schema_name: table.schema_name,
          table_type: table.table_type,
          columns: columnsResult.recordset,
        });
      }

      return schemas;
    } catch (error) {
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool.connected) {
      await this.pool.close();
    }
  }

  private convertRowsToStrings(
    rows: Record<string, unknown>[]
  ): TableDataRow[] {
    return rows.map((row) => this.convertRowToStrings(row));
  }

  private convertRowToStrings(row: Record<string, unknown>): TableDataRow {
    const result: TableDataRow = {};

    Object.entries(row).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        result[key] = "";
      } else if (value instanceof Date) {
        // Convert Date objects to ISO string to avoid localized format
        result[key] = value.toISOString();
      } else {
        result[key] = String(value);
      }
    });

    return result;
  }
}

export class MSSQLAdapter implements DatabaseAdapter {
  async connect(config: DatabaseConfig): Promise<DatabaseConnection> {
    const connection = new MSSQLConnection(config);
    // Test connection
    await connection.getTables();
    return connection;
  }
}

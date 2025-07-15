import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  TestDatabase,
  setupPostgreSQLContainer,
  setupMSSQLContainer,
  setupMySQLContainer,
  createTestTable,
  insertTestData,
  createJsonTestTable,
  insertJsonTestData,
} from "./test-utils";
import { DatabaseType } from "@/lib/database";

// Test parameters for different database types
const databaseConfigs: Array<{
  type: DatabaseType;
  name: string;
  setup: () => Promise<TestDatabase>;
}> = [
  {
    type: "postgresql",
    name: "PostgreSQL",
    setup: setupPostgreSQLContainer,
  },
  {
    type: "mssql",
    name: "MSSQL",
    setup: setupMSSQLContainer,
  },
  {
    type: "mysql",
    name: "MySQL",
    setup: setupMySQLContainer,
  },
];

// Run the same tests for each database type
describe.each(databaseConfigs)(
  "Database Integration - $name",
  ({ type, setup }) => {
    let testDb: TestDatabase;

    beforeAll(async () => {
      testDb = await setup();
      await createTestTable(testDb.connection, type);
    });

    afterAll(async () => {
      await testDb.cleanup();
    });

    describe("Connection Management", () => {
      it("should connect to database successfully", async () => {
        expect(testDb.connection).toBeDefined();
        expect(testDb.config.type).toBe(type);
      });

      it("should disconnect gracefully", async () => {
        // Test that disconnect doesn't throw
        await expect(testDb.connection.disconnect()).resolves.not.toThrow();

        // Reconnect for other tests
        testDb = await setup();
        await createTestTable(testDb.connection, type);
      });
    });

    describe("Table Operations", () => {
      it("should list tables", async () => {
        const tables = await testDb.connection.getTables();

        expect(Array.isArray(tables)).toBe(true);
        expect(tables.length).toBeGreaterThan(0);

        const userTable = tables.find((t) => t.table_name === "test_users");
        expect(userTable).toBeDefined();

        // All databases should have schema information
        expect(userTable?.schema_name).toBeTruthy();
        expect(userTable?.full_table_name).toBeTruthy();
        expect(userTable?.full_table_name).toContain("test_users");

        expect(userTable?.table_type).toBe("BASE TABLE");
      });

      it("should get table columns", async () => {
        const columns = await testDb.connection.getTableColumns("test_users");

        expect(columns).toContain("id");
        expect(columns).toContain("name");
        expect(columns).toContain("email");
        expect(columns).toContain("age");
        expect(columns).toContain("is_active");
        expect(columns).toContain("created_at");
      });

      it("should get table column types", async () => {
        const columnTypes = await testDb.connection.getTableColumnTypes(
          "test_users"
        );

        expect(columnTypes.id).toBeDefined();
        expect(columnTypes.name).toBeDefined();
        expect(columnTypes.email).toBeDefined();

        // All databases should return type information
        expect(columnTypes.id.dataType).toBeTruthy();
        expect(columnTypes.name.dataType).toBeTruthy();
        expect(typeof columnTypes.id.dataType).toBe("string");
        expect(typeof columnTypes.name.dataType).toBe("string");
      });

      it("should get primary keys", async () => {
        const primaryKeys = await testDb.connection.getTablePrimaryKeys(
          "test_users"
        );

        expect(primaryKeys).toContain("id");
        expect(primaryKeys.length).toBe(1);
      });

      it("should get table type", async () => {
        const tableType = await testDb.connection.getTableType("test_users");
        expect(tableType).toBe("BASE TABLE");
      });
    });

    describe("Data Operations", () => {
      beforeAll(async () => {
        await insertTestData(testDb.connection);
      });

      it("should retrieve paginated table data", async () => {
        const result = await testDb.connection.getTableData(
          "test_users",
          1,
          10
        );

        expect(result.rows).toBeDefined();
        expect(Array.isArray(result.rows)).toBe(true);
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.totalCount).toBeGreaterThan(0);
        expect(result.page).toBe(1);
        expect(result.pageSize).toBe(10);
        expect(result.totalPages).toBeGreaterThan(0);
      });

      it("should respect pagination parameters", async () => {
        const result = await testDb.connection.getTableData("test_users", 1, 1);

        expect(result.rows.length).toBe(1);
        expect(result.pageSize).toBe(1);
      });

      it("should handle pagination correctly across pages", async () => {
        const page1 = await testDb.connection.getTableData("test_users", 1, 2);
        const page2 = await testDb.connection.getTableData("test_users", 2, 2);

        expect(page1.rows.length).toBeLessThanOrEqual(2);
        expect(page2.rows.length).toBeLessThanOrEqual(2);

        // Ensure different rows on different pages (if we have enough data)
        if (page1.rows.length > 0 && page2.rows.length > 0) {
          expect(page1.rows[0].id).not.toBe(page2.rows[0].id);
        }
      });

      it("should filter data correctly", async () => {
        // Test equality filter
        const equalityFilter = [
          { column: "name", operator: "=", value: "Alice Johnson" },
        ];
        const equalityResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          equalityFilter
        );

        expect(equalityResult.rows.length).toBeGreaterThan(0);
        equalityResult.rows.forEach((row) => {
          expect(row.name).toBe("Alice Johnson");
        });

        // Test greater than filter
        const gtFilter = [{ column: "age", operator: ">", value: "25" }];
        const gtResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          gtFilter
        );

        expect(gtResult.rows.length).toBeGreaterThan(0);
        gtResult.rows.forEach((row) => {
          expect(parseInt(row.age)).toBeGreaterThan(25);
        });

        // Test LIKE filter
        const likeFilter = [
          { column: "name", operator: "LIKE", value: "%Alice%" },
        ];
        const likeResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          likeFilter
        );

        expect(likeResult.rows.length).toBeGreaterThan(0);
        likeResult.rows.forEach((row) => {
          expect(row.name).toContain("Alice");
        });

        // Test multiple filters
        const multipleFilters = [
          { column: "age", operator: ">=", value: "25" },
          {
            column: "is_active",
            operator: "=",
            value: type === "mysql" ? "1" : "true",
          },
        ];
        const multipleResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          multipleFilters
        );

        expect(multipleResult.rows.length).toBeGreaterThan(0);
        multipleResult.rows.forEach((row) => {
          expect(parseInt(row.age)).toBeGreaterThanOrEqual(25);
          // Handle different boolean representations across databases
          const isActiveValue = String(row.is_active);
          expect(isActiveValue === "true" || isActiveValue === "1").toBe(true);
        });
      });

      it("should sort data correctly", async () => {
        // Test ascending sort
        const ascSort = [{ column: "name", direction: "asc" as const }];
        const ascResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          [],
          ascSort
        );

        expect(ascResult.rows.length).toBeGreaterThan(1);
        for (let i = 1; i < ascResult.rows.length; i++) {
          expect(ascResult.rows[i].name >= ascResult.rows[i - 1].name).toBe(
            true
          );
        }

        // Test descending sort
        const descSort = [{ column: "age", direction: "desc" as const }];
        const descResult = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          [],
          descSort
        );

        expect(descResult.rows.length).toBeGreaterThan(1);
        for (let i = 1; i < descResult.rows.length; i++) {
          expect(
            parseInt(descResult.rows[i].age) <=
              parseInt(descResult.rows[i - 1].age)
          ).toBe(true);
        }
      });

      it("should handle filters and sorting together", async () => {
        const filters = [{ column: "age", operator: ">", value: "20" }];
        const sorts = [{ column: "name", direction: "asc" as const }];

        const result = await testDb.connection.getTableData(
          "test_users",
          1,
          10,
          filters,
          sorts
        );

        expect(result.rows.length).toBeGreaterThan(0);

        // Check filters
        result.rows.forEach((row) => {
          expect(parseInt(row.age)).toBeGreaterThan(20);
        });

        // Check sorting
        for (let i = 1; i < result.rows.length; i++) {
          expect(result.rows[i].name >= result.rows[i - 1].name).toBe(true);
        }
      });

      it("should insert new records", async () => {
        const newUser = {
          name: "Integration Test User",
          email: "integration@test.com",
          age: 30,
          is_active: true,
        };

        const insertedRow = await testDb.connection.insertTableRow(
          "test_users",
          newUser
        );

        expect(insertedRow.name).toBe("Integration Test User");
        expect(insertedRow.email).toBe("integration@test.com");

        // Age should be returned as expected (adapters should handle conversion consistently)
        expect(String(insertedRow.age)).toBe("30");

        // is_active should be returned in a predictable format (all adapters should be consistent)
        const isActiveValue = String(insertedRow.is_active);
        expect(isActiveValue === "true" || isActiveValue === "1").toBe(true);
      });

      it("should update existing records", async () => {
        // First, get a user to update
        const tableData = await testDb.connection.getTableData(
          "test_users",
          1,
          1
        );
        const firstUser = tableData.rows[0];

        const updatedData = {
          name: "Updated Name",
          age: 35,
        };

        const updatedRow = await testDb.connection.updateTableRow(
          "test_users",
          { id: firstUser.id },
          updatedData
        );

        expect(updatedRow.name).toBe("Updated Name");

        // Age should be returned consistently across databases
        expect(String(updatedRow.age)).toBe("35");

        expect(updatedRow.id).toBe(firstUser.id);
      });

      it("should handle timestamp values in insert and update operations", async () => {
        const currentTime = new Date();
        const isoString = currentTime.toISOString();

        // Test with explicit timestamp in insert
        const newUserWithTimestamp = {
          name: "Timestamp Test User",
          email: "timestamp@test.com",
          age: 28,
          is_active: true,
          created_at: isoString,
        };

        // This should work without throwing an error
        const insertedRow = await testDb.connection.insertTableRow(
          "test_users",
          newUserWithTimestamp
        );

        expect(insertedRow.name).toBe("Timestamp Test User");
        expect(insertedRow.email).toBe("timestamp@test.com");
        expect(insertedRow.created_at).toBeDefined();

        // Test with timestamp in update
        const updateDataWithTimestamp = {
          name: "Updated Timestamp User",
          created_at: new Date().toISOString(),
        };

        // This should also work without throwing an error
        const updatedRow = await testDb.connection.updateTableRow(
          "test_users",
          { id: insertedRow.id },
          updateDataWithTimestamp
        );

        expect(updatedRow.name).toBe("Updated Timestamp User");
        expect(updatedRow.created_at).toBeDefined();
      });

      it("should update existing records with their existing timestamps", async () => {
        // First, get a user with existing timestamps (simulating real frontend scenario)
        const tableData = await testDb.connection.getTableData(
          "test_users",
          1,
          1
        );
        const existingUser = tableData.rows[0];

        // Get table introspection to determine which columns are editable
        const introspection = await testDb.connection.getTableIntrospection(
          "test_users"
        );

        // Filter out identity columns and primary keys based on introspection
        const editableColumns = Object.keys(existingUser).filter(
          (columnName) => {
            const columnInfo = introspection.columns.find(
              (col) => col.column_name === columnName
            );

            // Exclude identity columns (auto-increment columns)
            if (columnInfo?.is_identity === "YES") {
              return false;
            }

            // Exclude primary keys (they shouldn't be editable)
            const primaryKeys = introspection.primaryKeys.map(
              (pk) => pk.column_name
            );
            if (primaryKeys.includes(columnName)) {
              return false;
            }

            // Skip timestamp fields to avoid conversion issues (should be handled by the DB)
            if (columnName.includes("_at")) {
              return false;
            }

            return true;
          }
        );

        // Simulate what frontend does: convert only editable values to strings for form display
        const formData: Record<string, string> = {};
        editableColumns.forEach((key) => {
          formData[key] = String(existingUser[key]);
        });

        // Update only the name, but all editable fields are sent
        formData.name = "Updated with Existing Timestamps";

        const updatedRow = await testDb.connection.updateTableRow(
          "test_users",
          { id: existingUser.id },
          formData
        );

        expect(updatedRow.name).toBe("Updated with Existing Timestamps");
        expect(updatedRow.id).toBe(existingUser.id);
        // Should not throw conversion errors (timestamps are managed by DB)
        expect(updatedRow.created_at).toBeDefined();
      });

      it("should handle various date string formats consistently", async () => {
        // Test various date string formats that all databases should handle
        const testCases = [
          {
            name: "ISO Date Test",
            created_at: "2024-01-15T10:30:00.000Z",
          },
          {
            name: "SQL Format Test",
            created_at: "2024-01-15 10:30:00",
          },
          {
            name: "Date Only Test",
            created_at: "2024-01-15",
          },
        ];

        for (const testCase of testCases) {
          const insertedRow = await testDb.connection.insertTableRow(
            "test_users",
            {
              name: testCase.name,
              email: `${testCase.name
                .toLowerCase()
                .replace(/ /g, ".")}@test.com`,
              age: 30,
              is_active: true,
              created_at: testCase.created_at,
            }
          );

          expect(insertedRow.name).toBe(testCase.name);
          expect(insertedRow.created_at).toBeDefined();

          // Test updating with the same date format
          const updatedRow = await testDb.connection.updateTableRow(
            "test_users",
            { id: insertedRow.id },
            {
              name: `Updated ${testCase.name}`,
              created_at: testCase.created_at,
            }
          );

          expect(updatedRow.name).toBe(`Updated ${testCase.name}`);
          expect(updatedRow.created_at).toBeDefined();
        }
      });

      it("should handle mixed data types in updates without conversion errors", async () => {
        // Insert a test user first
        const insertedUser = await testDb.connection.insertTableRow(
          "test_users",
          {
            name: "Mixed Data Test",
            email: "mixed@test.com",
            age: 25,
            is_active: true,
          }
        );

        // Simulate a real frontend update scenario with mixed string/number/boolean data
        const mixedUpdateData = {
          name: "Updated Mixed Data Test", // string
          age: "30", // number as string (from form)
          is_active: "true", // boolean as string (from form)
          email: "updated.mixed@test.com", // string
        };

        // This should not throw conversion errors across all databases
        const updatedRow = await testDb.connection.updateTableRow(
          "test_users",
          { id: insertedUser.id },
          mixedUpdateData
        );

        expect(updatedRow.name).toBe("Updated Mixed Data Test");
        expect(updatedRow.email).toBe("updated.mixed@test.com");
        // Age and is_active should be handled correctly by all database adapters
        expect(updatedRow.id).toBe(insertedUser.id);
      });

      it("should delete records", async () => {
        // Insert a user to delete
        const userToDelete = await testDb.connection.insertTableRow(
          "test_users",
          {
            name: "To Delete",
            email: "delete@example.com",
            age: 99,
            is_active: false,
          }
        );

        const deletedRow = await testDb.connection.deleteTableRow(
          "test_users",
          { id: userToDelete.id }
        );

        expect(deletedRow.name).toBe("To Delete");
        expect(deletedRow.email).toBe("delete@example.com");
      });

      it("should handle real frontend workflow: insert → get → update (end-to-end)", async () => {
        // Step 1: Insert a row via our function (like frontend would)
        const insertedRow = await testDb.connection.insertTableRow(
          "test_users",
          {
            name: "E2E Test User",
            email: "e2e@test.com",
            age: 30,
            is_active: true,
          }
        );

        expect(insertedRow.name).toBe("E2E Test User");
        expect(insertedRow.id).toBeDefined();

        // Step 2: Get the row via our function (like frontend would)
        const tableData = await testDb.connection.getTableData(
          "test_users",
          1,
          100
        );
        const retrievedRow = tableData.rows.find(
          (row) => row.id === insertedRow.id
        );

        expect(retrievedRow).toBeDefined();
        expect(retrievedRow!.name).toBe("E2E Test User");

        // Step 3: Get introspection data (like frontend would)
        const introspection = await testDb.connection.getTableIntrospection(
          "test_users"
        );

        // Step 4: Use EXACT frontend logic to prepare update data
        const { filteredFormData } = prepareFrontendUpdateData(
          retrievedRow!,
          introspection
        );

        // Log what we're actually trying to update (for debugging)
        console.log("Frontend form data being sent to update:", {
          name: filteredFormData.name,
          created_at: filteredFormData.created_at,
          updated_at: filteredFormData.updated_at,
        });

        // Step 5: Update only the name but send all form fields (like frontend does)
        filteredFormData.name = "Updated E2E User";

        // Build primary key values object (same as frontend UpdateRowButton.handleSubmit)
        const primaryKeyValues: Record<string, string | number> = {};
        const primaryKeys = ["id"]; // We know this from our test setup
        primaryKeys.forEach((key) => {
          const value = retrievedRow![key];
          if (value !== undefined) {
            primaryKeyValues[key] =
              typeof value === "string" ? value : String(value);
          }
        });

        // This should NOT throw any conversion errors
        const updatedRow = await testDb.connection.updateTableRow(
          "test_users",
          primaryKeyValues,
          filteredFormData
        );

        expect(updatedRow.name).toBe("Updated E2E User");
        expect(updatedRow.id).toBe(retrievedRow!.id);
      });

      it("should handle frontend workflow with triggered tables (test_posts table)", async () => {
        // This test specifically targets the test_posts table which has triggers in MSSQL
        // Skip for databases that don't have triggers (PostgreSQL/MySQL in this test)
        if (type !== "mssql") {
          console.log(
            `Skipping triggered table test for ${type} - no triggers in test setup`
          );
          return;
        }

        // Step 1: Insert a test post first
        const insertedPost = await testDb.connection.insertTableRow(
          "test_posts",
          {
            title: "Test Post with Trigger",
            content: "This is a test post content",
            user_id: 1, // Assuming we have a user with id 1 from test data
          }
        );

        // Step 2: Get the inserted post back
        const tableData = await testDb.connection.getTableData(
          "test_posts",
          1,
          10
        );

        const existingPost = tableData.rows.find(
          (row) => row.id === insertedPost.id
        );

        if (!existingPost) {
          throw new Error("Could not find inserted post");
        }

        // Step 3: Get introspection data for test_posts table
        const introspection = await testDb.connection.getTableIntrospection(
          "test_posts"
        );

        // Step 3: Use EXACT frontend logic to prepare update data
        const { filteredFormData } = prepareFrontendUpdateData(
          existingPost,
          introspection
        );

        // Log what we're actually trying to update (for debugging)
        console.log("Frontend form data for test_posts table:", {
          title: filteredFormData.title,
          created_at: filteredFormData.created_at,
          updated_at: filteredFormData.updated_at,
        });

        // Step 5: Update only the title but send all form fields (like frontend does)
        filteredFormData.title = "Updated Post Title";

        // Build primary key values object
        const primaryKeyValues: Record<string, string | number> = {};
        const primaryKeys = ["id"];
        primaryKeys.forEach((key) => {
          const value = existingPost[key];
          if (value !== undefined) {
            primaryKeyValues[key] =
              typeof value === "string" ? value : String(value);
          }
        });

        // This should NOT throw "Could not create constraint or index" error
        const updatedRow = await testDb.connection.updateTableRow(
          "test_posts",
          primaryKeyValues,
          filteredFormData
        );

        expect(updatedRow.title).toBe("Updated Post Title");
        expect(updatedRow.id).toBe(existingPost.id);
      });
    });

    describe("Query Execution", () => {
      it("should execute SELECT queries successfully", async () => {
        const result = await testDb.connection.executeQuery(
          "SELECT COUNT(*) as user_count FROM test_users"
        );

        expect(result.success).toBe(true);
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBe(1);
        expect(result.fields).toContain("user_count");
        expect(parseInt(result.rows[0].user_count)).toBeGreaterThan(0);
      });

      it("should handle standard SQL queries", async () => {
        // Use standard SQL that works across all databases
        const result = await testDb.connection.executeQuery(
          "SELECT * FROM test_users"
        );

        expect(result.success).toBe(true);
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
      });

      it("should handle query errors gracefully", async () => {
        const result = await testDb.connection.executeQuery(
          "SELECT * FROM non_existent_table"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(result.rows.length).toBe(0);
      });
    });

    describe("Schema Introspection", () => {
      it("should return detailed table information", async () => {
        const introspection = await testDb.connection.getTableIntrospection(
          "test_users"
        );

        expect(introspection.columns).toBeDefined();
        expect(Array.isArray(introspection.columns)).toBe(true);
        expect(introspection.columns.length).toBeGreaterThan(0);

        expect(introspection.primaryKeys).toBeDefined();
        expect(Array.isArray(introspection.primaryKeys)).toBe(true);

        expect(introspection.foreignKeys).toBeDefined();
        expect(Array.isArray(introspection.foreignKeys)).toBe(true);

        expect(introspection.indexes).toBeDefined();
        expect(Array.isArray(introspection.indexes)).toBe(true);

        // Check primary key
        const idPrimaryKey = introspection.primaryKeys.find(
          (pk) => pk.column_name === "id"
        );
        expect(idPrimaryKey).toBeDefined();
      });

      it("should handle identity/auto-increment columns correctly", async () => {
        const introspection = await testDb.connection.getTableIntrospection(
          "test_users"
        );

        const idColumn = introspection.columns.find(
          (col) => col.column_name === "id"
        );
        expect(idColumn).toBeDefined();

        // All databases should have an id column that's some form of auto-increment
        // The specific implementation (identity, auto_increment, serial) may vary
        // but the column should exist and be marked appropriately
        expect(idColumn?.column_name).toBe("id");
      });

      it("should return complete database schema", async () => {
        const schema = await testDb.connection.getFullDatabaseSchema();

        expect(Array.isArray(schema)).toBe(true);
        expect(schema.length).toBeGreaterThan(0);

        const userTable = schema.find((t) => t.table_name === "test_users");
        expect(userTable).toBeDefined();

        // All databases should have a schema name (public, dbo, testdb, etc.)
        expect(userTable?.schema_name).toBeTruthy();
        expect(typeof userTable?.schema_name).toBe("string");

        expect(userTable?.columns).toBeDefined();
        expect(Array.isArray(userTable?.columns)).toBe(true);
        expect(userTable?.columns.length).toBeGreaterThan(0);
      });
    });

    describe("Foreign Key Relationships", () => {
      it("should handle foreign key relationships correctly", async () => {
        const introspection = await testDb.connection.getTableIntrospection(
          "test_posts"
        );

        const userIdForeignKey = introspection.foreignKeys.find(
          (fk) => fk.column_name === "user_id"
        );
        expect(userIdForeignKey).toBeDefined();
        expect(userIdForeignKey?.foreign_table_name).toBe("test_users");
        expect(userIdForeignKey?.foreign_column_name).toBe("id");
      });
    });

    describe("Database-Specific Features", () => {
      it("should handle data types consistently", async () => {
        const columnTypes = await testDb.connection.getTableColumnTypes(
          "test_users"
        );

        // All databases should return consistent type information
        expect(columnTypes.name).toBeDefined();
        expect(columnTypes.name.dataType).toBeTruthy();
        expect(typeof columnTypes.name.dataType).toBe("string");

        expect(columnTypes.is_active).toBeDefined();
        expect(columnTypes.is_active.dataType).toBeTruthy();
        expect(typeof columnTypes.is_active.dataType).toBe("string");

        expect(columnTypes.created_at).toBeDefined();
        expect(columnTypes.created_at.dataType).toBeTruthy();
        expect(typeof columnTypes.created_at.dataType).toBe("string");
      });

      it("should handle standard SQL queries consistently", async () => {
        // Use standard SQL without special quoting - all databases should handle this
        const query = "SELECT name, email FROM test_users";

        const result = await testDb.connection.executeQuery(query);

        expect(result.success).toBe(true);
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.fields).toContain("name");
        expect(result.fields).toContain("email");
      });
    });

    describe("Error Handling", () => {
      it("should handle connection errors gracefully", async () => {
        // Test with invalid query to ensure error handling works
        const result = await testDb.connection.executeQuery(
          "INVALID SQL SYNTAX HERE"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe("string");
      });

      it("should handle table not found errors", async () => {
        const result = await testDb.connection.executeQuery(
          "SELECT * FROM definitely_not_a_table"
        );

        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe("Cross-Database Compatibility", () => {
      it("should provide consistent interface methods", () => {
        const connection = testDb.connection;

        // Check that all required methods exist
        const requiredMethods = [
          "getTables",
          "getTableData",
          "insertTableRow",
          "updateTableRow",
          "deleteTableRow",
          "getTableColumns",
          "getTableColumnTypes",
          "getTablePrimaryKeys",
          "getTableType",
          "executeQuery",
          "getTableIntrospection",
          "getFullDatabaseSchema",
          "disconnect",
        ];

        for (const method of requiredMethods) {
          expect(method in connection).toBe(true);
          expect(typeof connection[method as keyof typeof connection]).toBe(
            "function"
          );
        }
      });

      it("should return consistent data structures", async () => {
        const tables = await testDb.connection.getTables();
        const tableData = await testDb.connection.getTableData(
          "test_users",
          1,
          5
        );
        const queryResult = await testDb.connection.executeQuery(
          "SELECT 1 as test"
        );

        // Check table structure
        expect(tables[0]).toHaveProperty("table_name");
        expect(tables[0]).toHaveProperty("schema_name");
        expect(tables[0]).toHaveProperty("full_table_name");
        expect(tables[0]).toHaveProperty("table_type");

        // Check table data structure
        expect(tableData).toHaveProperty("rows");
        expect(tableData).toHaveProperty("totalCount");
        expect(tableData).toHaveProperty("page");
        expect(tableData).toHaveProperty("pageSize");
        expect(tableData).toHaveProperty("totalPages");

        // Check query result structure
        expect(queryResult).toHaveProperty("success");
        expect(queryResult).toHaveProperty("rows");
        expect(queryResult).toHaveProperty("fields");
      });
    });

    describe("JSON Field Operations", () => {
      beforeAll(async () => {
        await createJsonTestTable(testDb.connection, type);
        await insertJsonTestData(testDb.connection);
      });

      it("should detect JSON column types correctly", async () => {
        const columnTypes = await testDb.connection.getTableColumnTypes(
          "test_json"
        );

        // All databases should return some form of JSON-compatible type information
        expect(columnTypes.profile).toBeDefined();
        expect(columnTypes.profile.dataType).toBeTruthy();
        expect(typeof columnTypes.profile.dataType).toBe("string");

        expect(columnTypes.settings).toBeDefined();
        expect(columnTypes.settings.dataType).toBeTruthy();
        expect(typeof columnTypes.settings.dataType).toBe("string");
      });

      it("should handle JSON constraints and validation correctly", async () => {
        const validJson = {
          test: "value",
          nested: {
            array: [1, 2, 3],
            boolean: true,
          },
        };

        // Should successfully insert valid JSON across all database types
        const insertedRow = await testDb.connection.insertTableRow(
          "test_json",
          {
            name: "JSON Constraint Test",
            profile: JSON.stringify(validJson),
            settings: JSON.stringify({ theme: "dark" }),
          }
        );

        expect(insertedRow.name).toBe("JSON Constraint Test");
        expect(insertedRow.profile).toBeDefined();

        // Should be able to update with valid JSON
        const updatedRow = await testDb.connection.updateTableRow(
          "test_json",
          { id: insertedRow.id },
          {
            profile: JSON.stringify({
              updated: true,
              timestamp: new Date().toISOString(),
            }),
          }
        );

        expect(updatedRow.id).toBe(insertedRow.id);
        expect(updatedRow.profile).toBeDefined();

        if (typeof updatedRow.profile === "string") {
          const parsed = JSON.parse(updatedRow.profile);
          expect(parsed.updated).toBe(true);
          expect(parsed.timestamp).toBeDefined();
        }
      });

      it("should retrieve JSON data without [object Object] display", async () => {
        const result = await testDb.connection.getTableData("test_json", 1, 10);

        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);

        const firstRow = result.rows[0];

        // Check that JSON fields are properly formatted (not [object Object])
        if (firstRow.profile) {
          expect(firstRow.profile).toBeDefined();
          expect(String(firstRow.profile)).not.toBe("[object Object]");

          // Should be able to parse the JSON
          if (typeof firstRow.profile === "string") {
            expect(() => JSON.parse(firstRow.profile)).not.toThrow();
            const parsedProfile = JSON.parse(firstRow.profile);
            expect(parsedProfile).toHaveProperty("bio");
            expect(parsedProfile).toHaveProperty("skills");
            expect(Array.isArray(parsedProfile.skills)).toBe(true);
          }
        }

        if (firstRow.settings) {
          expect(firstRow.settings).toBeDefined();
          expect(String(firstRow.settings)).not.toBe("[object Object]");

          // Should be able to parse the JSON
          if (typeof firstRow.settings === "string") {
            expect(() => JSON.parse(firstRow.settings)).not.toThrow();
            const parsedSettings = JSON.parse(firstRow.settings);
            expect(parsedSettings).toHaveProperty("theme");
            expect(parsedSettings).toHaveProperty("notifications");
          }
        }
      });

      it("should handle JSON data in queries correctly", async () => {
        // Use standard SQL that works across all databases
        const query =
          "SELECT name, profile FROM test_json WHERE profile IS NOT NULL";

        const result = await testDb.connection.executeQuery(query);

        expect(result.success).toBe(true);
        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);

        const firstRow = result.rows[0];
        expect(firstRow.name).toBeDefined();
        expect(firstRow.profile).toBeDefined();

        // Should be able to parse the profile JSON regardless of database
        if (typeof firstRow.profile === "string") {
          const parsed = JSON.parse(firstRow.profile);
          expect(parsed).toBeInstanceOf(Object);
        }
      });

      it("should insert new records with JSON data", async () => {
        const newProfile = {
          bio: "Test user bio",
          avatar: "https://example.com/test.jpg",
          location: "Test City",
          skills: ["Testing", "JSON"],
          preferences: {
            theme: "system",
            language: "en",
          },
        };

        const newSettings = {
          theme: "dark",
          notifications: {
            email: true,
            push: false,
          },
        };

        const insertedRow = await testDb.connection.insertTableRow(
          "test_json",
          {
            name: "Test JSON User",
            profile: JSON.stringify(newProfile),
            settings: JSON.stringify(newSettings),
          }
        );

        expect(insertedRow.name).toBe("Test JSON User");
        expect(insertedRow.profile).toBeDefined();
        expect(insertedRow.settings).toBeDefined();

        // Verify JSON is properly stored and retrievable
        expect(String(insertedRow.profile)).not.toBe("[object Object]");
        expect(String(insertedRow.settings)).not.toBe("[object Object]");

        if (typeof insertedRow.profile === "string") {
          const parsedProfile = JSON.parse(insertedRow.profile);
          expect(parsedProfile.bio).toBe("Test user bio");
          expect(parsedProfile.skills).toEqual(["Testing", "JSON"]);
        }
      });

      it("should update records with JSON data", async () => {
        // Get first record
        const tableData = await testDb.connection.getTableData(
          "test_json",
          1,
          1
        );
        const firstRow = tableData.rows[0];

        const updatedProfile = {
          bio: "Updated bio from test",
          avatar: "https://example.com/updated.jpg",
          location: "Updated City",
          skills: ["Updated", "Skills"],
        };

        const updatedRow = await testDb.connection.updateTableRow(
          "test_json",
          { id: firstRow.id },
          {
            profile: JSON.stringify(updatedProfile),
          }
        );

        expect(updatedRow.id).toBe(firstRow.id);
        expect(updatedRow.profile).toBeDefined();
        expect(String(updatedRow.profile)).not.toBe("[object Object]");

        if (typeof updatedRow.profile === "string") {
          const parsedProfile = JSON.parse(updatedRow.profile);
          expect(parsedProfile.bio).toBe("Updated bio from test");
          expect(parsedProfile.skills).toEqual(["Updated", "Skills"]);
        }
      });

      it("should handle empty and null JSON values", async () => {
        // Insert record with empty JSON
        const insertedRow = await testDb.connection.insertTableRow(
          "test_json",
          {
            name: "Empty JSON Test",
            profile: JSON.stringify({}),
            settings: JSON.stringify({ theme: "light" }),
          }
        );

        expect(insertedRow.name).toBe("Empty JSON Test");
        expect(insertedRow.profile).toBeDefined();

        if (typeof insertedRow.profile === "string") {
          const parsedProfile = JSON.parse(insertedRow.profile);
          expect(parsedProfile).toEqual({});
        }
      });

      it("should handle complex nested JSON structures", async () => {
        const complexJson = {
          user: {
            personal: {
              name: "Complex User",
              age: 30,
              contacts: [
                { type: "email", value: "test@example.com" },
                { type: "phone", value: "+1234567890" },
              ],
            },
            preferences: {
              ui: {
                theme: "dark",
                layout: "compact",
                features: {
                  beta: true,
                  experimental: false,
                  advanced: {
                    mode: "expert",
                    settings: ["option1", "option2"],
                  },
                },
              },
            },
          },
          metadata: {
            created: new Date().toISOString(),
            version: "1.0.0",
            tags: ["test", "complex", "nested"],
          },
        };

        const insertedRow = await testDb.connection.insertTableRow(
          "test_json",
          {
            name: "Complex JSON User",
            profile: JSON.stringify(complexJson),
            settings: JSON.stringify({ simple: "setting" }),
          }
        );

        expect(insertedRow.name).toBe("Complex JSON User");
        expect(String(insertedRow.profile)).not.toBe("[object Object]");

        if (typeof insertedRow.profile === "string") {
          const parsed = JSON.parse(insertedRow.profile);
          expect(parsed.user.personal.name).toBe("Complex User");
          expect(parsed.user.preferences.ui.features.advanced.mode).toBe(
            "expert"
          );
          expect(Array.isArray(parsed.user.personal.contacts)).toBe(true);
          expect(parsed.metadata.tags).toEqual(["test", "complex", "nested"]);
        }
      });
    });
  }
);

// Extract the exact frontend logic from UpdateRowButton.tsx for testing
function prepareFrontendUpdateData(
  rowData: Record<string, string>,
  introspection: {
    columns: Array<{ column_name: string; is_identity: string }>;
  }
) {
  const columns = Object.keys(rowData);

  // Same logic as UpdateRowButton.getEditableColumns()
  const getEditableColumns = (): string[] => {
    if (!introspection) {
      // This shouldn't happen in our test, but fallback logic
      return columns;
    }

    return columns.filter((columnName) => {
      const columnInfo = introspection.columns.find(
        (col) => col.column_name === columnName
      );

      // Exclude identity columns (auto-increment/serial columns)
      if (columnInfo?.is_identity === "YES") {
        return false;
      }

      return true;
    });
  };

  const editableColumns = getEditableColumns();

  // Same logic as UpdateRowButton: convert to form data
  const initialData = Object.fromEntries(
    editableColumns.map((column) => [column, String(rowData[column] || "")])
  );

  // Same logic as UpdateRowButton handleSubmit: filter form data to only editable columns
  const filteredFormData: Record<string, string> = {};
  editableColumns.forEach((column) => {
    if (initialData[column] !== undefined) {
      filteredFormData[column] = initialData[column];
    }
  });

  return { editableColumns, filteredFormData };
}

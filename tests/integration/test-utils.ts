import { expect } from "vitest";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { MSSQLServerContainer } from "@testcontainers/mssqlserver";
import { MySqlContainer } from "@testcontainers/mysql";
import { DatabaseConfig, DatabaseConnection } from "@/lib/database";
import { PostgreSQLAdapter } from "@/lib/database/postgresql-adapter";
import { MSSQLAdapter } from "@/lib/database/mssql-adapter";
import { MySQLAdapter } from "@/lib/database/mysql-adapter";

export interface TestDatabase {
  connection: DatabaseConnection;
  config: DatabaseConfig;
  cleanup: () => Promise<void>;
}

export async function setupPostgreSQLContainer(): Promise<TestDatabase> {
  const container = await new PostgreSqlContainer("postgres:15")
    .withDatabase("testdb")
    .withUsername("testuser")
    .withPassword("testpass")
    .start();

  const config: DatabaseConfig = {
    type: "postgresql",
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    username: container.getUsername(),
    password: container.getPassword(),
  };

  const adapter = new PostgreSQLAdapter();
  const connection = await adapter.connect(config);

  return {
    connection,
    config,
    cleanup: async () => {
      await connection.disconnect();
      await container.stop();
    },
  };
}

export async function setupMSSQLContainer(): Promise<TestDatabase> {
  const container = await new MSSQLServerContainer(
    "mcr.microsoft.com/azure-sql-edge:latest"
  )
    .acceptLicense()
    .start();
  // throw new Error(123);

  const config: DatabaseConfig = {
    type: "mssql",
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    username: container.getUsername(),
    password: container.getPassword(),
  };

  const adapter = new MSSQLAdapter();
  const connection = await adapter.connect(config);

  return {
    connection,
    config,
    cleanup: async () => {
      await connection.disconnect();
      await container.stop();
    },
  };
}

export async function setupMySQLContainer(): Promise<TestDatabase> {
  const container = await new MySqlContainer("mysql:8.0")
    .withDatabase("testdb")
    .withUsername("testuser")
    .withUserPassword("testpass")
    .withRootPassword("rootpass")
    .start();

  const config: DatabaseConfig = {
    type: "mysql",
    host: container.getHost(),
    port: container.getPort(),
    database: container.getDatabase(),
    username: container.getUsername(),
    password: container.getUserPassword(),
  };

  const adapter = new MySQLAdapter();
  const connection = await adapter.connect(config);

  return {
    connection,
    config,
    cleanup: async () => {
      await connection.disconnect();
      await container.stop();
    },
  };
}

export async function createTestTable(
  connection: DatabaseConnection,
  dbType: "postgresql" | "mssql" | "mysql"
): Promise<void> {
  let createTableSQL: string;

  if (dbType === "postgresql") {
    createTableSQL = `
      CREATE TABLE test_users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        age INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE test_posts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        user_id INTEGER REFERENCES test_users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } else if (dbType === "mssql") {
    createTableSQL = `
      CREATE TABLE test_users (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        email NVARCHAR(255) UNIQUE,
        age INT,
        is_active BIT DEFAULT 1,
        created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE test_posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        content NTEXT,
        user_id INT,
        created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES test_users(id)
      );


    `;
  } else {
    // MySQL - execute statements separately
    const createUsersSQL = `
      CREATE TABLE test_users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE,
        age INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createPostsSQL = `
      CREATE TABLE test_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        user_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES test_users(id)
      )
    `;

    await connection.executeQuery(createUsersSQL);
    await connection.executeQuery(createPostsSQL);
    return;
  }

  await connection.executeQuery(createTableSQL);

  // Create triggers for MSSQL test_posts table
  if (dbType === "mssql") {
    const triggerSQL = `
      CREATE TRIGGER tr_test_posts_updated_at ON test_posts
      AFTER UPDATE AS BEGIN
        UPDATE test_posts
        SET updated_at = GETDATE()
        FROM test_posts p
        INNER JOIN inserted i ON p.id = i.id;
      END;
    `;
    await connection.executeQuery(triggerSQL);
  }
}

export async function insertTestData(
  connection: DatabaseConnection
): Promise<void> {
  // Insert test users
  await connection.insertTableRow("test_users", {
    name: "Alice Johnson",
    email: "alice@test.com",
    age: 30,
    is_active: true,
  });

  await connection.insertTableRow("test_users", {
    name: "Bob Smith",
    email: "bob@test.com",
    age: 25,
    is_active: false,
  });

  // Insert test posts
  await connection.insertTableRow("test_posts", {
    title: "First Post",
    content: "This is the first test post",
    user_id: 1,
  });

  await connection.insertTableRow("test_posts", {
    title: "Second Post",
    content: "This is the second test post",
    user_id: 2,
  });
}

export function expectTableRow(
  row: Record<string, string>,
  expected: Record<string, unknown>
): void {
  for (const [key, value] of Object.entries(expected)) {
    if (value === null) {
      expect(row[key] === "" || row[key] === null).toBe(true);
    } else if (typeof value === "boolean") {
      // Handle boolean conversion differences between databases
      expect(
        row[key] === "true" || row[key] === "1" || row[key] === "TRUE"
      ).toBe(value);
    } else {
      expect(row[key]).toBe(String(value));
    }
  }
}

export async function createJsonTestTable(
  connection: DatabaseConnection,
  dbType: "postgresql" | "mssql" | "mysql"
): Promise<void> {
  let createTableSQL: string;

  if (dbType === "postgresql") {
    createTableSQL = `
      CREATE TABLE test_json (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        profile JSONB,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } else if (dbType === "mssql") {
    createTableSQL = `
      CREATE TABLE test_json (
        id INT IDENTITY(1,1) PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        profile NVARCHAR(MAX) CHECK (ISJSON(profile) = 1),
        settings NVARCHAR(MAX) CHECK (ISJSON(settings) = 1),
        created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } else {
    // MySQL
    createTableSQL = `
      CREATE TABLE test_json (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        profile JSON,
        settings JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
  }

  await connection.executeQuery(createTableSQL);
}

export async function insertJsonTestData(
  connection: DatabaseConnection
): Promise<void> {
  const sampleProfile = {
    bio: "Software developer with 5 years experience",
    avatar: "https://example.com/avatar1.jpg",
    location: "New York",
    skills: ["JavaScript", "Python", "React"],
    social: {
      twitter: "@johndoe",
      github: "johndoe",
      linkedin: "john-doe",
    },
  };

  const sampleSettings = {
    theme: "dark",
    language: "en",
    notifications: {
      email: true,
      push: false,
      sms: true,
    },
    privacy: {
      showEmail: false,
      showProfile: true,
    },
    features: ["beta", "experimental"],
  };

  // Insert test records with JSON data
  await connection.insertTableRow("test_json", {
    name: "John Doe",
    profile: JSON.stringify(sampleProfile),
    settings: JSON.stringify(sampleSettings),
  });

  await connection.insertTableRow("test_json", {
    name: "Jane Smith",
    profile: JSON.stringify({
      bio: "UX Designer passionate about user experience",
      avatar: "https://example.com/avatar2.jpg",
      location: "San Francisco",
      skills: ["Figma", "Sketch", "Adobe XD"],
      social: {
        twitter: "@janesmith",
        github: "janesmith",
      },
    }),
    settings: JSON.stringify({
      theme: "light",
      language: "es",
      notifications: {
        email: false,
        push: true,
        sms: false,
      },
      privacy: {
        showEmail: true,
        showProfile: true,
      },
    }),
  });

  // Insert a record with empty JSON profile
  await connection.insertTableRow("test_json", {
    name: "Bob Wilson",
    settings: JSON.stringify({
      theme: "auto",
      language: "en",
    }),
  });
}

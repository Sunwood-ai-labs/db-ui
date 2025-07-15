-- MSSQL Database Initialization Script
-- Note: Database is created automatically by the container
CREATE DATABASE testdb;

USE testdb;

-- Create users table
CREATE TABLE users (
    id INT IDENTITY(1, 1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    email NVARCHAR(255) UNIQUE NOT NULL,
    age INT,
    is_active BIT DEFAULT 1,
    preferences NVARCHAR(MAX),
    -- JSON data stored as NVARCHAR
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE()
);

-- Create posts table
CREATE TABLE posts (
    id INT IDENTITY(1, 1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    content NTEXT,
    user_id INT,
    published BIT DEFAULT 0,
    metadata NVARCHAR(MAX),
    -- JSON data for post metadata
    created_at DATETIME2 DEFAULT GETDATE(),
    updated_at DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create categories table
CREATE TABLE categories (
    id INT IDENTITY(1, 1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL UNIQUE,
    description NTEXT,
    created_at DATETIME2 DEFAULT GETDATE()
);

-- Create post_categories junction table
CREATE TABLE post_categories (
    post_id INT,
    category_id INT,
    PRIMARY KEY (post_id, category_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Insert sample users
INSERT INTO
    users (name, email, age, is_active, preferences)
VALUES
    (
        'Johny Nick Doe',
        'john.doe@example.com',
        30,
        1,
        '{"theme": "dark", "language": "en", "notifications": {"email": true, "push": false}, "dashboard": {"widgets": ["recent_posts", "analytics"]}}'
    ),
    (
        'Jane Smith',
        'jane.smith@example.com',
        25,
        1,
        '{"theme": "light", "language": "en", "notifications": {"email": false, "push": true}, "dashboard": {"widgets": ["todo_list", "calendar"]}}'
    ),
    (
        'Bob Johnson',
        'bob.johnson@example.com',
        35,
        0,
        '{"theme": "auto", "language": "es", "notifications": {"email": true, "push": true}, "privacy": {"profile_visible": false}}'
    ),
    (
        'Alice Brown',
        'alice.brown@example.com',
        28,
        1,
        '{"theme": "light", "language": "fr", "notifications": {"email": true, "push": false}, "timezone": "Europe/Paris"}'
    ),
    (
        'Charlie Wilson',
        'charlie.wilson@example.com',
        42,
        1,
        '{"theme": "dark", "language": "en", "notifications": {"email": false, "push": false}, "advanced": {"debug_mode": true, "api_access": ["read", "write"]}}'
    );

-- Insert sample categories
INSERT INTO
    categories (name, description)
VALUES
    (
        'Technology',
        'Posts about technology and programming'
    ),
    (
        'Lifestyle',
        'Posts about lifestyle and personal experiences'
    ),
    (
        'Business',
        'Posts about business and entrepreneurship'
    ),
    ('Travel', 'Posts about travel and adventures'),
    ('Food', 'Posts about cooking and restaurants');

-- Insert sample posts
INSERT INTO
    posts (title, content, user_id, published, metadata)
VALUES
    (
        'Getting Started with MSSQL',
        'A comprehensive guide to SQL Server database management...',
        1,
        1,
        '{"tags": ["database", "mssql", "tutorial"], "reading_time": 15, "difficulty": "beginner", "seo": {"meta_description": "Learn SQL Server basics", "keywords": ["sql server", "database", "tutorial"]}}'
    ),
    (
        'My Journey as a Developer',
        'Sharing my experiences in software development...',
        2,
        1,
        '{"tags": ["personal", "career", "development"], "reading_time": 8, "difficulty": "beginner", "featured": true, "comments_enabled": true}'
    ),
    (
        'Building Scalable Applications',
        'Best practices for building applications that scale...',
        1,
        0,
        '{"tags": ["architecture", "scalability", "performance"], "reading_time": 22, "difficulty": "advanced", "series": {"name": "Architecture Series", "part": 1}}'
    ),
    (
        'Traveling Through Europe',
        'Amazing experiences from my European adventure...',
        4,
        1,
        '{"tags": ["travel", "europe", "adventure"], "reading_time": 12, "difficulty": "beginner", "location": {"countries": ["France", "Italy", "Spain"]}, "photos": 15}'
    ),
    (
        'The Future of Remote Work',
        'How remote work is changing the business landscape...',
        5,
        1,
        '{"tags": ["business", "remote work", "future"], "reading_time": 18, "difficulty": "intermediate", "trending": true, "sources": ["https://example.com/study1", "https://example.com/study2"]}'
    ),
    (
        'Cooking Italian Cuisine',
        'Traditional recipes from my grandmother...',
        3,
        0,
        '{"tags": ["cooking", "italian", "recipes"], "reading_time": 25, "difficulty": "intermediate", "ingredients_count": 12, "prep_time": 45}'
    ),
    (
        'Database Design Patterns',
        'Common patterns for designing efficient databases...',
        1,
        1,
        '{"tags": ["database", "design patterns", "architecture"], "reading_time": 30, "difficulty": "advanced", "code_examples": 8, "diagrams": 5}'
    ),
    (
        'Work-Life Balance Tips',
        'How to maintain a healthy work-life balance...',
        2,
        1,
        '{"tags": ["lifestyle", "productivity", "wellness"], "reading_time": 10, "difficulty": "beginner", "tips_count": 12, "actionable": true}'
    );

-- Insert sample post-category relationships
INSERT INTO
    post_categories (post_id, category_id)
VALUES
    (1, 1),
    -- Getting Started with MSSQL -> Technology
    (2, 2),
    -- My Journey as a Developer -> Lifestyle
    (3, 1),
    -- Building Scalable Applications -> Technology
    (3, 3),
    -- Building Scalable Applications -> Business
    (4, 4),
    -- Traveling Through Europe -> Travel
    (5, 3),
    -- The Future of Remote Work -> Business
    (6, 5),
    -- Cooking Italian Cuisine -> Food
    (7, 1),
    -- Database Design Patterns -> Technology
    (8, 2);

-- Work-Life Balance Tips -> Lifestyle
-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE INDEX idx_posts_published ON posts(published);

CREATE INDEX idx_posts_created_at ON posts(created_at);

-- Create trigger for updated_at on users table
CREATE TRIGGER tr_users_updated_at ON users
AFTER
UPDATE
    AS BEGIN
UPDATE
    users
SET
    updated_at = GETDATE()
FROM
    users u
    INNER JOIN inserted i ON u.id = i.id;

END;

-- Create trigger for updated_at on posts table
CREATE TRIGGER tr_posts_updated_at ON posts
AFTER
UPDATE
    AS BEGIN
UPDATE
    posts
SET
    updated_at = GETDATE()
FROM
    posts p
    INNER JOIN inserted i ON p.id = i.id;

END;

-- JSON validation constraints (SQL Server 2016+)
-- Add constraint to ensure preferences column contains valid JSON
ALTER TABLE
    users
ADD
    CONSTRAINT CK_users_preferences_json CHECK (
        preferences IS NULL
        OR ISJSON(preferences) = 1
    );

-- Add constraint to ensure metadata column contains valid JSON
ALTER TABLE
    posts
ADD
    CONSTRAINT CK_posts_metadata_json CHECK (
        metadata IS NULL
        OR ISJSON(metadata) = 1
    );

-- Example JSON queries that work with MSSQL
-- These demonstrate how to query JSON data in MSSQL
-- Query users with dark theme preference
-- SELECT * FROM users WHERE JSON_VALUE(preferences, '$.theme') = 'dark';
-- Query users with email notifications enabled
-- SELECT * FROM users WHERE JSON_VALUE(preferences, '$.notifications.email') = 'true';
-- Query posts with specific tags
-- SELECT * FROM posts WHERE JSON_VALUE(metadata, '$.tags[0]') = 'database';
-- Extract reading time from all posts
-- SELECT title, JSON_VALUE(metadata, '$.reading_time') as reading_time FROM posts;
-- Query posts with difficulty level
-- SELECT * FROM posts WHERE JSON_VALUE(metadata, '$.difficulty') = 'advanced';
-- Update JSON data (example - commented out)
-- UPDATE users SET preferences = JSON_MODIFY(preferences, '$.theme', 'light') WHERE id = 1;
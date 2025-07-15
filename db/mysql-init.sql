-- MySQL Database Initialization Script
-- Create database (if not exists)
CREATE DATABASE IF NOT EXISTS testdb;

USE testdb;

-- Create users table with JSON field
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  age INT,
  is_active BOOLEAN DEFAULT TRUE,
  profile JSON,
  preferences JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create posts table with JSON metadata
CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT,
  user_id INT,
  published BOOLEAN DEFAULT FALSE,
  metadata JSON,
  tags JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create categories table
CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create post_categories junction table with compound primary key
CREATE TABLE post_categories (
  post_id INT,
  category_id INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  assigned_by INT,
  PRIMARY KEY (post_id, category_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE
  SET
    NULL
);

-- Create user_sessions table with compound primary key
CREATE TABLE user_sessions (
  user_id INT,
  session_id VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  session_data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  PRIMARY KEY (user_id, session_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create activity_log table without primary key (for demonstration)
CREATE TABLE activity_log (
  user_id INT,
  action VARCHAR(255),
  resource_type VARCHAR(100),
  resource_id INT,
  metadata JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE
  SET
    NULL
);

-- Insert sample users with JSON data
INSERT INTO
  users (
    name,
    email,
    age,
    is_active,
    profile,
    preferences
  )
VALUES
  (
    'John Doe',
    'john.doe@example.com',
    30,
    TRUE,
    '{"bio": "Software developer with 10 years experience", "avatar": "https://example.com/avatar1.jpg", "location": "New York", "skills": ["JavaScript", "Python", "MySQL"]}',
    '{"theme": "dark", "notifications": {"email": true, "push": false}, "language": "en"}'
  ),
  (
    'Jane Smith',
    'jane.smith@example.com',
    25,
    TRUE,
    '{"bio": "UI/UX Designer passionate about user experience", "avatar": "https://example.com/avatar2.jpg", "location": "San Francisco", "skills": ["Figma", "Sketch", "Adobe XD"]}',
    '{"theme": "light", "notifications": {"email": false, "push": true}, "language": "en"}'
  ),
  (
    'Bob Johnson',
    'bob.johnson@example.com',
    35,
    FALSE,
    '{"bio": "DevOps engineer", "avatar": "https://example.com/avatar3.jpg", "location": "Seattle", "skills": ["Docker", "Kubernetes", "AWS"]}',
    '{"theme": "auto", "notifications": {"email": true, "push": true}, "language": "en"}'
  ),
  (
    'Alice Brown',
    'alice.brown@example.com',
    28,
    TRUE,
    '{"bio": "Data scientist and ML enthusiast", "avatar": "https://example.com/avatar4.jpg", "location": "Boston", "skills": ["Python", "R", "TensorFlow"]}',
    '{"theme": "dark", "notifications": {"email": true, "push": false}, "language": "es"}'
  ),
  (
    'Charlie Wilson',
    'charlie.wilson@example.com',
    42,
    TRUE,
    '{"bio": "Product manager with startup experience", "avatar": "https://example.com/avatar5.jpg", "location": "Austin", "skills": ["Product Strategy", "Agile", "Analytics"]}',
    '{"theme": "light", "notifications": {"email": false, "push": false}, "language": "fr"}'
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

-- Insert sample posts with JSON metadata and tags
INSERT INTO
  posts (
    title,
    content,
    user_id,
    published,
    metadata,
    tags
  )
VALUES
  (
    'Getting Started with MySQL',
    'A comprehensive guide to MySQL database management...',
    1,
    TRUE,
    '{"read_time": 10, "difficulty": "beginner", "featured": true, "seo": {"meta_description": "Learn MySQL basics", "keywords": ["mysql", "database", "tutorial"]}}',
    '["mysql", "database", "tutorial", "beginner"]'
  ),
  (
    'My Journey as a Developer',
    'Sharing my experiences in software development...',
    2,
    TRUE,
    '{"read_time": 7, "difficulty": "intermediate", "featured": false, "seo": {"meta_description": "Developer journey story", "keywords": ["career", "development", "experience"]}}',
    '["career", "personal", "development", "story"]'
  ),
  (
    'Building Scalable Applications',
    'Best practices for building applications that scale...',
    1,
    FALSE,
    '{"read_time": 15, "difficulty": "advanced", "featured": true, "seo": {"meta_description": "Scalability best practices", "keywords": ["scalability", "architecture", "performance"]}}',
    '["scalability", "architecture", "performance", "advanced"]'
  ),
  (
    'Traveling Through Europe',
    'Amazing experiences from my European adventure...',
    4,
    TRUE,
    '{"read_time": 5, "difficulty": "beginner", "featured": false, "seo": {"meta_description": "European travel guide", "keywords": ["travel", "europe", "adventure"]}}',
    '["travel", "europe", "adventure", "photography"]'
  ),
  (
    'The Future of Remote Work',
    'How remote work is changing the business landscape...',
    5,
    TRUE,
    '{"read_time": 12, "difficulty": "intermediate", "featured": true, "seo": {"meta_description": "Remote work trends", "keywords": ["remote work", "business", "future"]}}',
    '["remote work", "business", "future", "productivity"]'
  ),
  (
    'Cooking Italian Cuisine',
    'Traditional recipes from my grandmother...',
    3,
    FALSE,
    '{"read_time": 8, "difficulty": "beginner", "featured": false, "seo": {"meta_description": "Italian cooking recipes", "keywords": ["cooking", "italian", "recipes"]}}',
    '["cooking", "italian", "recipes", "family"]'
  ),
  (
    'Database Design Patterns',
    'Common patterns for designing efficient databases...',
    1,
    TRUE,
    '{"read_time": 20, "difficulty": "advanced", "featured": true, "seo": {"meta_description": "Database design guide", "keywords": ["database", "design", "patterns"]}}',
    '["database", "design", "patterns", "architecture"]'
  ),
  (
    'Work-Life Balance Tips',
    'How to maintain a healthy work-life balance...',
    2,
    TRUE,
    '{"read_time": 6, "difficulty": "beginner", "featured": false, "seo": {"meta_description": "Work-life balance advice", "keywords": ["work life balance", "productivity", "wellness"]}}',
    '["work life balance", "productivity", "wellness", "tips"]'
  );

-- Insert sample post-category relationships
INSERT INTO
  post_categories (post_id, category_id, assigned_by)
VALUES
  (1, 1, 1),
  -- Getting Started with MySQL -> Technology
  (2, 2, 2),
  -- My Journey as a Developer -> Lifestyle
  (3, 1, 1),
  -- Building Scalable Applications -> Technology
  (3, 3, 1),
  -- Building Scalable Applications -> Business
  (4, 4, 4),
  -- Traveling Through Europe -> Travel
  (5, 3, 5),
  -- The Future of Remote Work -> Business
  (6, 5, 3),
  -- Cooking Italian Cuisine -> Food
  (7, 1, 1),
  -- Database Design Patterns -> Technology
  (8, 2, 2);

-- Work-Life Balance Tips -> Lifestyle
-- Insert sample user sessions with compound primary keys
INSERT INTO
  user_sessions (
    user_id,
    session_id,
    ip_address,
    user_agent,
    session_data,
    expires_at
  )
VALUES
  (
    1,
    'sess_abc123def456',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    '{"last_activity": "2024-01-15T10:30:00Z", "pages_visited": ["/dashboard", "/posts", "/profile"], "cart_items": []}',
    DATE_ADD(NOW(), INTERVAL 24 HOUR)
  ),
  (
    2,
    'sess_xyz789ghi012',
    '10.0.0.50',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    '{"last_activity": "2024-01-15T11:15:00Z", "pages_visited": ["/", "/posts/my-journey"], "cart_items": []}',
    DATE_ADD(NOW(), INTERVAL 24 HOUR)
  ),
  (
    1,
    'sess_mobile_001',
    '192.168.1.100',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
    '{"last_activity": "2024-01-15T09:45:00Z", "pages_visited": ["/mobile-dashboard"], "cart_items": [], "device_type": "mobile"}',
    DATE_ADD(NOW(), INTERVAL 7 DAY)
  );

-- Insert sample activity log entries (table without primary key)
INSERT INTO
  activity_log (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata,
    ip_address,
    user_agent
  )
VALUES
  (
    1,
    'CREATE',
    'post',
    1,
    '{"title": "Getting Started with MySQL", "published": true}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  ),
  (
    2,
    'VIEW',
    'post',
    1,
    '{"duration_seconds": 180, "scroll_percentage": 85}',
    '10.0.0.50',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  ),
  (
    1,
    'UPDATE',
    'profile',
    1,
    '{"fields_changed": ["bio", "avatar"], "old_avatar": "https://example.com/old_avatar.jpg"}',
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  ),
  (
    3,
    'LOGIN',
    'user',
    3,
    '{"login_method": "email", "session_duration": null}',
    '172.16.0.10',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36'
  ),
  (
    2,
    'DELETE',
    'comment',
    15,
    '{"reason": "spam", "content_preview": "Check out this amazing offer..."}',
    '10.0.0.50',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
  );

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);

CREATE INDEX idx_posts_user_id ON posts(user_id);

CREATE INDEX idx_posts_published ON posts(published);

CREATE INDEX idx_posts_created_at ON posts(created_at);

CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);

CREATE INDEX idx_activity_log_timestamp ON activity_log(timestamp);

CREATE INDEX idx_activity_log_action ON activity_log(action);

-- Create indexes on JSON fields (MySQL 5.7+)
CREATE INDEX idx_users_profile_location ON users((CAST(profile ->> '$.location' AS CHAR(100))));

CREATE INDEX idx_posts_metadata_featured ON posts((CAST(metadata ->> '$.featured' AS UNSIGNED)));
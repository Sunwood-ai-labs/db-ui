-- Create users table with enhanced fields
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_profiles table
CREATE TABLE user_profiles (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(50),
  country VARCHAR(50),
  bio TEXT,
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  parent_id INTEGER REFERENCES categories(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create products table
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id),
  image_url VARCHAR(255),
  specifications JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create orders table
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  shipping_address TEXT NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create order_items table
CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create reviews table
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  product_id INTEGER REFERENCES products(id),
  rating INTEGER NOT NULL CHECK (
    rating >= 1
    AND rating <= 5
  ),
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notifications table with generated primary key that isn't called 'id'
CREATE TABLE notifications (
  notification_id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  notification_type VARCHAR(20) NOT NULL DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cart_items table with compound primary key
CREATE TABLE cart_items (
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, product_id)
);

-- Create system_logs table without any primary key (append-only audit log)
CREATE TABLE system_logs (
  log_level VARCHAR(10) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  user_id INTEGER REFERENCES users(id),
  ip_address INET,
  user_agent TEXT,
  details JSONB,
  logged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create user_order_summary view (not updatable)
CREATE VIEW user_order_summary AS
SELECT
  u.id as user_id,
  -- Primary key from users table
  u.username,
  u.email,
  up.first_name,
  up.last_name,
  COUNT(o.id) as total_orders,
  COALESCE(SUM(o.total_amount), 0) as total_spent,
  AVG(o.total_amount) as average_order_value,
  MAX(o.created_at) as last_order_date,
  COUNT(
    CASE
      WHEN o.status = 'completed' THEN 1
    END
  ) as completed_orders,
  COUNT(
    CASE
      WHEN o.status = 'pending' THEN 1
    END
  ) as pending_orders
FROM
  users u
  LEFT JOIN user_profiles up ON u.id = up.user_id
  LEFT JOIN orders o ON u.id = o.user_id
GROUP BY
  u.id,
  u.username,
  u.email,
  up.first_name,
  up.last_name;

-- Insert sample data
-- Insert users
INSERT INTO
  users (username, email, password_hash)
VALUES
  (
    'john_doe',
    'john@example.com',
    'hashed_password_1'
  ),
  (
    'jane_smith',
    'jane@example.com',
    'hashed_password_2'
  ),
  (
    'bob_wilson',
    'bob@example.com',
    'hashed_password_3'
  ),
  (
    'alice_brown',
    'alice@example.com',
    'hashed_password_4'
  );

-- Insert user profiles
INSERT INTO
  user_profiles (
    user_id,
    first_name,
    last_name,
    phone,
    city,
    country
  )
VALUES
  (
    1,
    'John',
    'Doe',
    '+1234567890',
    'New York',
    'USA'
  ),
  (
    2,
    'Jane',
    'Smith',
    '+1987654321',
    'London',
    'UK'
  ),
  (
    3,
    'Bob',
    'Wilson',
    '+1122334455',
    'Sydney',
    'Australia'
  ),
  (
    4,
    'Alice',
    'Brown',
    '+1555666777',
    'Toronto',
    'Canada'
  );

-- Insert categories
INSERT INTO
  categories (name, description, parent_id)
VALUES
  (
    'Electronics',
    'Electronic devices and accessories',
    NULL
  ),
  ('Clothing', 'Fashion and apparel', NULL),
  ('Books', 'Books and publications', NULL),
  (
    'Smartphones',
    'Mobile phones and accessories',
    1
  ),
  ('Laptops', 'Portable computers', 1),
  ('T-Shirts', 'Casual wear', 2),
  ('Jeans', 'Denim wear', 2);

-- Insert products
INSERT INTO
  products (
    name,
    description,
    price,
    stock_quantity,
    category_id,
    specifications
  )
VALUES
  (
    'iPhone 13',
    'Latest Apple smartphone',
    999.99,
    50,
    4,
    '{
      "display": {
        "size": "6.1 inches",
        "resolution": "2532x1170",
        "type": "Super Retina XDR OLED"
      },
      "processor": "A15 Bionic chip",
      "storage": ["128GB", "256GB", "512GB"],
      "colors": ["Pink", "Blue", "Midnight", "Starlight", "Red"],
      "camera": {
        "rear": "12MP dual-camera system",
        "front": "12MP TrueDepth camera"
      },
      "features": ["Face ID", "Water resistant", "5G", "MagSafe"],
      "dimensions": {
        "height": 146.7,
        "width": 71.5,
        "depth": 7.65,
        "weight": 174
      }
    }' :: jsonb
  ),
  (
    'MacBook Pro',
    'Professional laptop',
    1299.99,
    30,
    5,
    '{
      "display": {
        "size": "13.3 inches",
        "resolution": "2560x1600",
        "type": "Retina"
      },
      "processor": "Apple M2 chip",
      "memory": ["8GB", "16GB", "24GB"],
      "storage": ["256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD"],
      "ports": ["2x Thunderbolt 4", "3.5mm headphone jack"],
      "features": ["Touch Bar", "Touch ID", "Force Touch trackpad"],
      "battery": "Up to 20 hours",
      "operating_system": "macOS",
      "dimensions": {
        "height": 1.56,
        "width": 30.41,
        "depth": 21.24,
        "weight": 1.4
      }
    }' :: jsonb
  ),
  (
    'Classic T-Shirt',
    'Cotton t-shirt',
    19.99,
    100,
    6,
    '{
      "material": "100% Cotton",
      "fit": "Regular",
      "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
      "colors": ["White", "Black", "Navy", "Gray", "Red"],
      "care_instructions": ["Machine wash cold", "Tumble dry low", "Do not bleach"],
      "country_of_origin": "Bangladesh",
      "sustainability": {
        "organic": false,
        "fair_trade": true,
        "recycled_content": 0
      }
    }' :: jsonb
  ),
  (
    'Slim Fit Jeans',
    'Modern denim jeans',
    49.99,
    75,
    7,
    '{
      "material": "98% Cotton, 2% Elastane",
      "fit": "Slim",
      "rise": "Mid-rise",
      "sizes": ["28", "30", "32", "34", "36", "38", "40"],
      "colors": ["Dark Blue", "Light Blue", "Black", "Gray"],
      "features": ["Stretch comfort", "5-pocket styling", "Button fly"],
      "care_instructions": ["Machine wash warm", "Tumble dry medium", "Iron medium heat"],
      "inseam_options": ["30 inches", "32 inches", "34 inches"],
      "sustainability": {
        "organic": false,
        "water_saving_process": true,
        "recycled_content": 15
      }
    }' :: jsonb
  ),
  (
    'Python Programming',
    'Learn Python programming',
    29.99,
    200,
    3,
    '{
      "author": "John Smith",
      "publisher": "Tech Books Publishing",
      "isbn": "978-1234567890",
      "pages": 542,
      "language": "English",
      "edition": "3rd Edition",
      "publication_year": 2023,
      "format": ["Paperback", "Hardcover", "E-book"],
      "topics": ["Python Basics", "Web Development", "Data Science", "Machine Learning"],
      "skill_level": "Beginner to Intermediate",
      "includes": ["Online resources", "Practice exercises", "Sample projects"],
      "dimensions": {
        "height": 23.4,
        "width": 15.6,
        "thickness": 3.2,
        "weight": 0.8
      }
    }' :: jsonb
  ),
  -- Additional products for pagination testing
  (
    'Samsung Galaxy S23',
    'Android flagship smartphone',
    899.99,
    45,
    4,
    '{
      "display": {"size": "6.1 inches", "resolution": "2340x1080", "type": "Dynamic AMOLED 2X"},
      "processor": "Snapdragon 8 Gen 2",
      "storage": ["128GB", "256GB"],
      "colors": ["Phantom Black", "Cream", "Green", "Lavender"],
      "camera": {"rear": "50MP triple camera", "front": "12MP"},
      "features": ["5G", "Wireless charging", "Water resistant"]
    }' :: jsonb
  ),
  (
    'iPad Air',
    'Versatile tablet for work and play',
    599.99,
    60,
    1,
    '{
      "display": {"size": "10.9 inches", "resolution": "2360x1640", "type": "Liquid Retina"},
      "processor": "Apple M1 chip",
      "storage": ["64GB", "256GB"],
      "colors": ["Space Gray", "Pink", "Purple", "Blue", "Starlight"],
      "features": ["Touch ID", "Apple Pencil support", "Magic Keyboard compatible"]
    }' :: jsonb
  ),
  (
    'Dell XPS 13',
    'Premium ultrabook',
    1199.99,
    25,
    5,
    '{
      "display": {"size": "13.4 inches", "resolution": "1920x1200", "type": "InfinityEdge"},
      "processor": "Intel Core i7-1165G7",
      "memory": ["8GB", "16GB", "32GB"],
      "storage": ["256GB SSD", "512GB SSD", "1TB SSD"],
      "operating_system": "Windows 11"
    }' :: jsonb
  ),
  (
    'Sony WH-1000XM4',
    'Noise-canceling headphones',
    349.99,
    80,
    1,
    '{
      "type": "Over-ear",
      "connectivity": ["Bluetooth", "3.5mm jack", "USB-C"],
      "features": ["Active noise canceling", "30-hour battery", "Quick charge"],
      "colors": ["Black", "Silver"]
    }' :: jsonb
  ),
  (
    'Nike Air Max 270',
    'Comfortable running shoes',
    150.00,
    120,
    2,
    '{
      "type": "Running shoes",
      "sizes": ["6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Black/White", "Navy/Gray", "Red/Black"],
      "features": ["Air Max cushioning", "Mesh upper", "Rubber outsole"]
    }' :: jsonb
  ),
  (
    'Levi''s 501 Jeans',
    'Original straight leg jeans',
    89.99,
    90,
    7,
    '{
      "material": "100% Cotton",
      "fit": "Straight",
      "sizes": ["28", "30", "32", "34", "36", "38"],
      "colors": ["Medium Stonewash", "Dark Stonewash", "Black"],
      "features": ["Button fly", "5-pocket styling", "Shrink-to-fit"]
    }' :: jsonb
  ),
  (
    'JavaScript: The Good Parts',
    'Programming book',
    24.99,
    150,
    3,
    '{
      "author": "Douglas Crockford",
      "publisher": "O''Reilly Media",
      "isbn": "978-0596517748",
      "pages": 176,
      "language": "English",
      "edition": "1st Edition",
      "publication_year": 2008
    }' :: jsonb
  ),
  (
    'Google Pixel 7',
    'Pure Android experience',
    599.99,
    40,
    4,
    '{
      "display": {"size": "6.3 inches", "resolution": "2400x1080", "type": "OLED"},
      "processor": "Google Tensor G2",
      "storage": ["128GB", "256GB"],
      "colors": ["Obsidian", "Snow", "Lemongrass"],
      "camera": {"rear": "50MP dual camera", "front": "10.8MP"}
    }' :: jsonb
  ),
  (
    'Microsoft Surface Laptop 5',
    'Elegant touchscreen laptop',
    999.99,
    35,
    5,
    '{
      "display": {"size": "13.5 inches", "resolution": "2256x1504", "type": "PixelSense touchscreen"},
      "processor": "Intel Core i5-1235U",
      "memory": ["8GB", "16GB"],
      "storage": ["256GB SSD", "512GB SSD"],
      "operating_system": "Windows 11"
    }' :: jsonb
  ),
  (
    'Adidas Ultraboost 22',
    'Performance running shoes',
    180.00,
    95,
    2,
    '{
      "type": "Running shoes",
      "sizes": ["6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Core Black", "Cloud White", "Solar Red"],
      "features": ["Boost midsole", "Primeknit upper", "Continental rubber outsole"]
    }' :: jsonb
  ),
  (
    'Polo Ralph Lauren Shirt',
    'Classic polo shirt',
    85.00,
    110,
    6,
    '{
      "material": "100% Cotton Pique",
      "fit": "Classic",
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "colors": ["White", "Navy", "Red", "Green", "Yellow"],
      "features": ["Two-button placket", "Ribbed collar", "Side vents"]
    }' :: jsonb
  ),
  (
    'Clean Code',
    'Software craftsmanship book',
    42.99,
    180,
    3,
    '{
      "author": "Robert C. Martin",
      "publisher": "Prentice Hall",
      "isbn": "978-0132350884",
      "pages": 464,
      "language": "English",
      "edition": "1st Edition",
      "publication_year": 2008
    }' :: jsonb
  ),
  (
    'OnePlus 11',
    'Flagship killer smartphone',
    699.99,
    50,
    4,
    '{
      "display": {"size": "6.7 inches", "resolution": "3216x1440", "type": "LTPO3 AMOLED"},
      "processor": "Snapdragon 8 Gen 2",
      "storage": ["128GB", "256GB"],
      "colors": ["Titan Black", "Eternal Green"],
      "camera": {"rear": "50MP triple camera", "front": "16MP"}
    }' :: jsonb
  ),
  (
    'Apple Watch Series 8',
    'Advanced smartwatch',
    399.99,
    70,
    1,
    '{
      "display": {"size": "45mm", "type": "Always-On Retina"},
      "connectivity": ["GPS", "Cellular"],
      "features": ["ECG", "Blood oxygen", "Temperature sensing", "Crash detection"],
      "colors": ["Midnight", "Starlight", "Silver", "Red"]
    }' :: jsonb
  ),
  (
    'HP Spectre x360',
    '2-in-1 convertible laptop',
    1249.99,
    20,
    5,
    '{
      "display": {"size": "13.5 inches", "resolution": "3000x2000", "type": "OLED touchscreen"},
      "processor": "Intel Core i7-1165G7",
      "memory": ["16GB", "32GB"],
      "storage": ["512GB SSD", "1TB SSD"],
      "features": ["360-degree hinge", "Pen support"]
    }' :: jsonb
  ),
  (
    'Bose QuietComfort 45',
    'Premium noise-canceling headphones',
    329.99,
    65,
    1,
    '{
      "type": "Over-ear",
      "connectivity": ["Bluetooth", "3.5mm jack"],
      "features": ["Active noise canceling", "24-hour battery", "Comfort design"],
      "colors": ["Black", "White Smoke"]
    }' :: jsonb
  ),
  (
    'Converse Chuck Taylor All Star',
    'Classic canvas sneakers',
    55.00,
    200,
    2,
    '{
      "type": "Casual sneakers",
      "material": "Canvas upper",
      "sizes": ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Black", "White", "Red", "Navy", "Pink"],
      "features": ["Rubber toe cap", "Metal eyelets", "Vulcanized rubber sole"]
    }' :: jsonb
  ),
  (
    'Tommy Hilfiger Hoodie',
    'Comfortable cotton hoodie',
    79.99,
    85,
    6,
    '{
      "material": "80% Cotton, 20% Polyester",
      "fit": "Regular",
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "colors": ["Navy", "Gray", "Black", "White"],
      "features": ["Kangaroo pocket", "Drawstring hood", "Ribbed cuffs"]
    }' :: jsonb
  ),
  (
    'Design Patterns',
    'Gang of Four programming book',
    54.99,
    120,
    3,
    '{
      "author": "Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides",
      "publisher": "Addison-Wesley",
      "isbn": "978-0201633612",
      "pages": 395,
      "language": "English",
      "edition": "1st Edition",
      "publication_year": 1994
    }' :: jsonb
  ),
  (
    'Xiaomi 13',
    'Flagship Android phone',
    749.99,
    55,
    4,
    '{
      "display": {"size": "6.36 inches", "resolution": "2400x1080", "type": "AMOLED"},
      "processor": "Snapdragon 8 Gen 2",
      "storage": ["128GB", "256GB", "512GB"],
      "colors": ["Black", "White", "Green"],
      "camera": {"rear": "50MP triple camera", "front": "32MP"}
    }' :: jsonb
  ),
  (
    'iPad Pro 12.9',
    'Professional tablet',
    1099.99,
    30,
    1,
    '{
      "display": {"size": "12.9 inches", "resolution": "2732x2048", "type": "Liquid Retina XDR"},
      "processor": "Apple M2 chip",
      "storage": ["128GB", "256GB", "512GB", "1TB", "2TB"],
      "colors": ["Space Gray", "Silver"],
      "features": ["Face ID", "Apple Pencil support", "Magic Keyboard compatible"]
    }' :: jsonb
  ),
  (
    'ASUS ROG Strix G15',
    'Gaming laptop',
    1599.99,
    15,
    5,
    '{
      "display": {"size": "15.6 inches", "resolution": "1920x1080", "refresh_rate": "144Hz"},
      "processor": "AMD Ryzen 9 5900HX",
      "graphics": "NVIDIA RTX 3070",
      "memory": ["16GB", "32GB"],
      "storage": ["512GB SSD", "1TB SSD"]
    }' :: jsonb
  ),
  (
    'AirPods Pro 2nd Gen',
    'Wireless noise-canceling earbuds',
    249.99,
    100,
    1,
    '{
      "type": "In-ear",
      "connectivity": ["Bluetooth", "Lightning"],
      "features": ["Active noise canceling", "Transparency mode", "Spatial audio", "H2 chip"],
      "battery": "6 hours + 24 hours with case"
    }' :: jsonb
  ),
  (
    'Vans Old Skool',
    'Classic skate shoes',
    65.00,
    150,
    2,
    '{
      "type": "Skate shoes",
      "material": "Canvas and suede upper",
      "sizes": ["4", "5", "6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Black/White", "Navy/White", "Red/White", "All Black"],
      "features": ["Waffle outsole", "Padded collar", "Signature side stripe"]
    }' :: jsonb
  ),
  (
    'Champion Reverse Weave Hoodie',
    'Premium heavyweight hoodie',
    65.00,
    75,
    6,
    '{
      "material": "82% Cotton, 18% Polyester",
      "weight": "12 oz",
      "sizes": ["S", "M", "L", "XL", "XXL"],
      "colors": ["Oxford Gray", "Navy", "Black", "Maroon"],
      "features": ["Reverse weave construction", "Double-needle stitching", "Kangaroo pocket"]
    }' :: jsonb
  ),
  (
    'You Don''t Know JS',
    'JavaScript book series',
    39.99,
    140,
    3,
    '{
      "author": "Kyle Simpson",
      "publisher": "O''Reilly Media",
      "isbn": "978-1491924464",
      "pages": 278,
      "language": "English",
      "edition": "2nd Edition",
      "publication_year": 2020
    }' :: jsonb
  ),
  (
    'Nothing Phone 2',
    'Unique transparent design phone',
    599.99,
    35,
    4,
    '{
      "display": {"size": "6.7 inches", "resolution": "2412x1080", "type": "LTPO OLED"},
      "processor": "Snapdragon 8+ Gen 1",
      "storage": ["128GB", "256GB", "512GB"],
      "colors": ["White", "Dark Gray"],
      "features": ["Glyph Interface", "Wireless charging", "IP54 rating"]
    }' :: jsonb
  ),
  (
    'Surface Pro 9',
    '2-in-1 tablet laptop',
    999.99,
    25,
    1,
    '{
      "display": {"size": "13 inches", "resolution": "2880x1920", "type": "PixelSense touchscreen"},
      "processor": "Intel Core i5-1235U",
      "memory": ["8GB", "16GB", "32GB"],
      "storage": ["128GB SSD", "256GB SSD", "512GB SSD", "1TB SSD"],
      "colors": ["Platinum", "Graphite", "Sapphire", "Forest"]
    }' :: jsonb
  ),
  (
    'Lenovo ThinkPad X1 Carbon',
    'Business ultrabook',
    1399.99,
    20,
    5,
    '{
      "display": {"size": "14 inches", "resolution": "1920x1200", "type": "IPS"},
      "processor": "Intel Core i7-1165G7",
      "memory": ["16GB", "32GB"],
      "storage": ["512GB SSD", "1TB SSD"],
      "features": ["ThinkPad keyboard", "TrackPoint", "MIL-STD tested"]
    }' :: jsonb
  ),
  (
    'Beats Studio Buds',
    'True wireless earbuds',
    149.99,
    90,
    1,
    '{
      "type": "In-ear",
      "connectivity": ["Bluetooth"],
      "features": ["Active noise canceling", "Transparency mode", "IPX4 rating"],
      "colors": ["Black", "White", "Red"],
      "battery": "8 hours + 16 hours with case"
    }' :: jsonb
  ),
  (
    'New Balance 990v5',
    'Premium running shoes',
    185.00,
    60,
    2,
    '{
      "type": "Running shoes",
      "material": "Suede and mesh upper",
      "sizes": ["6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Gray", "Navy", "Black"],
      "features": ["ENCAP midsole", "Blown rubber outsole", "Made in USA"]
    }' :: jsonb
  ),
  (
    'Uniqlo Heattech Crew Neck',
    'Thermal base layer',
    19.90,
    180,
    6,
    '{
      "material": "Acrylic, Polyester, Rayon, Spandex",
      "technology": "Heattech fabric",
      "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
      "colors": ["Black", "White", "Gray", "Navy"],
      "features": ["Moisture-wicking", "Heat retention", "Odor control"]
    }' :: jsonb
  ),
  (
    'Eloquent JavaScript',
    'Modern JavaScript programming',
    32.99,
    160,
    3,
    '{
      "author": "Marijn Haverbeke",
      "publisher": "No Starch Press",
      "isbn": "978-1593279509",
      "pages": 472,
      "language": "English",
      "edition": "3rd Edition",
      "publication_year": 2018
    }' :: jsonb
  ),
  (
    'Motorola Edge 40',
    'Mid-range smartphone',
    549.99,
    40,
    4,
    '{
      "display": {"size": "6.55 inches", "resolution": "2400x1080", "type": "pOLED"},
      "processor": "MediaTek Dimensity 8020",
      "storage": ["128GB", "256GB"],
      "colors": ["Lunar Blue", "Eclipse Black"],
      "camera": {"rear": "50MP dual camera", "front": "32MP"}
    }' :: jsonb
  ),
  (
    'MacBook Air M2',
    'Lightweight laptop',
    1199.99,
    40,
    5,
    '{
      "display": {"size": "13.6 inches", "resolution": "2560x1664", "type": "Liquid Retina"},
      "processor": "Apple M2 chip",
      "memory": ["8GB", "16GB", "24GB"],
      "storage": ["256GB SSD", "512GB SSD", "1TB SSD", "2TB SSD"],
      "colors": ["Space Gray", "Silver", "Gold", "Starlight"]
    }' :: jsonb
  ),
  (
    'JBL Flip 6',
    'Portable Bluetooth speaker',
    129.99,
    85,
    1,
    '{
      "type": "Portable speaker",
      "connectivity": ["Bluetooth 5.1"],
      "features": ["IP67 waterproof", "12-hour playtime", "PartyBoost"],
      "colors": ["Black", "Blue", "Red", "Teal", "Gray", "Pink"],
      "dimensions": {"length": 17.8, "width": 6.8, "height": 7.2}
    }' :: jsonb
  ),
  (
    'Allbirds Tree Runners',
    'Sustainable running shoes',
    98.00,
    70,
    2,
    '{
      "type": "Running shoes",
      "material": "Eucalyptus tree fiber",
      "sizes": ["5", "6", "7", "8", "9", "10", "11", "12"],
      "colors": ["Natural White", "Charcoal", "Stormy Blue"],
      "features": ["Machine washable", "Carbon neutral", "Moisture-wicking"]
    }' :: jsonb
  ),
  (
    'Patagonia Better Sweater',
    'Fleece jacket',
    99.00,
    55,
    2,
    '{
      "material": "100% Recycled Polyester",
      "fit": "Regular",
      "sizes": ["XS", "S", "M", "L", "XL", "XXL"],
      "colors": ["Black", "Navy", "Gray", "Green"],
      "features": ["Full-zip", "Stand-up collar", "Zippered chest pocket"]
    }' :: jsonb
  ),
  (
    'Refactoring',
    'Code improvement techniques',
    47.99,
    100,
    3,
    '{
      "author": "Martin Fowler",
      "publisher": "Addison-Wesley",
      "isbn": "978-0134757599",
      "pages": 448,
      "language": "English",
      "edition": "2nd Edition",
      "publication_year": 2018
    }' :: jsonb
  ),
  (
    'Fairphone 4',
    'Sustainable modular phone',
    579.99,
    25,
    4,
    '{
      "display": {"size": "6.3 inches", "resolution": "2340x1080", "type": "IPS LCD"},
      "processor": "Snapdragon 750G",
      "storage": ["128GB", "256GB"],
      "colors": ["Speckled Green", "Gray"],
      "features": ["Modular design", "5-year warranty", "Recycled materials"]
    }' :: jsonb
  ),
  (
    'Steam Deck',
    'Handheld gaming PC',
    649.99,
    10,
    1,
    '{
      "display": {"size": "7 inches", "resolution": "1280x800", "type": "LCD touchscreen"},
      "processor": "AMD Zen 2 4-core",
      "storage": ["64GB eMMC", "256GB SSD", "512GB SSD"],
      "features": ["SteamOS", "Trackpads", "Gyroscope"],
      "battery": "2-8 hours depending on game"
    }' :: jsonb
  ),
  (
    'Razer DeathAdder V3',
    'Gaming mouse',
    99.99,
    80,
    1,
    '{
      "type": "Gaming mouse",
      "sensor": "Focus Pro 30K",
      "connectivity": ["USB-C", "Wireless"],
      "features": ["30,000 DPI", "90-hour battery", "8 programmable buttons"],
      "colors": ["Black", "White"]
    }' :: jsonb
  ),
  (
    'Logitech MX Master 3S',
    'Productivity mouse',
    99.99,
    95,
    1,
    '{
      "type": "Wireless mouse",
      "connectivity": ["Bluetooth", "USB receiver"],
      "features": ["4,000 DPI sensor", "70-day battery", "Multi-device support"],
      "colors": ["Graphite", "Pale Gray", "Rose"]
    }' :: jsonb
  ),
  (
    'Keychron K8',
    'Wireless mechanical keyboard',
    89.99,
    60,
    1,
    '{
      "type": "Mechanical keyboard",
      "layout": "87-key tenkeyless",
      "switches": ["Gateron Blue", "Gateron Brown", "Gateron Red"],
      "connectivity": ["Bluetooth", "USB-C"],
      "features": ["Backlight", "Mac/Windows compatible"]
    }' :: jsonb
  ),
  (
    'IKEA BEKANT Desk',
    'Office desk',
    179.99,
    30,
    1,
    '{
      "material": "Particleboard with laminate",
      "dimensions": {"length": 160, "width": 80, "height": 75},
      "colors": ["White", "Black-brown", "Oak veneer"],
      "features": ["Cable management", "Adjustable feet", "10-year warranty"],
      "assembly_required": true
    }' :: jsonb
  ),
  (
    'Herman Miller Aeron Chair',
    'Ergonomic office chair',
    1395.00,
    5,
    1,
    '{
      "type": "Office chair",
      "sizes": ["A (Small)", "B (Medium)", "C (Large)"],
      "features": ["PostureFit SL", "Tilt limiter", "Forward tilt", "Adjustable arms"],
      "colors": ["Carbon", "Mineral", "Zinc"],
      "warranty": "12 years"
    }' :: jsonb
  ),
  (
    'Sony A7 IV',
    'Full-frame mirrorless camera',
    2498.00,
    8,
    1,
    '{
      "type": "Mirrorless camera",
      "sensor": "33MP full-frame CMOS",
      "video": "4K 60p recording",
      "features": ["5-axis stabilization", "693 AF points", "Real-time tracking"],
      "battery": "530 shots per charge"
    }' :: jsonb
  ),
  (
    'Canon EF 50mm f/1.8',
    'Portrait lens',
    125.00,
    45,
    1,
    '{
      "type": "Prime lens",
      "focal_length": "50mm",
      "aperture": "f/1.8 to f/22",
      "mount": "Canon EF",
      "features": ["STM autofocus", "7-blade aperture", "Lightweight design"],
      "weight": "160g"
    }' :: jsonb
  ),
  (
    'DJI Mini 3',
    'Compact drone',
    759.99,
    12,
    1,
    '{
      "type": "Consumer drone",
      "camera": "4K/30fps video",
      "flight_time": "38 minutes",
      "weight": "249g",
      "features": ["3-axis gimbal", "Obstacle avoidance", "ActiveTrack 4.0"],
      "range": "12 km"
    }' :: jsonb
  );

-- Insert orders
INSERT INTO
  orders (
    user_id,
    status,
    total_amount,
    shipping_address,
    payment_status
  )
VALUES
  (
    1,
    'completed',
    1019.98,
    '123 Main St, New York, USA',
    'paid'
  ),
  (
    2,
    'processing',
    69.98,
    '456 High St, London, UK',
    'paid'
  ),
  (
    3,
    'pending',
    1299.99,
    '789 Beach Rd, Sydney, Australia',
    'pending'
  );

-- Insert order items
INSERT INTO
  order_items (order_id, product_id, quantity, unit_price)
VALUES
  (1, 1, 1, 999.99),
  (1, 3, 1, 19.99),
  (2, 3, 2, 19.99),
  (2, 4, 1, 49.99),
  (3, 2, 1, 1299.99);

-- Insert reviews
INSERT INTO
  reviews (user_id, product_id, rating, comment)
VALUES
  (1, 1, 5, 'Great phone, amazing camera!'),
  (2, 3, 4, 'Comfortable and good quality'),
  (3, 2, 5, 'Best laptop I have ever used'),
  (4, 4, 3, 'Good fit but a bit expensive');

-- Insert notifications
INSERT INTO
  notifications (
    user_id,
    title,
    message,
    notification_type,
    is_read
  )
VALUES
  (
    1,
    'Order Shipped',
    'Your order #1 has been shipped and is on its way!',
    'info',
    false
  ),
  (
    1,
    'Welcome!',
    'Welcome to our store! Enjoy shopping with us.',
    'welcome',
    true
  ),
  (
    2,
    'Payment Processed',
    'Your payment for order #2 has been successfully processed.',
    'success',
    false
  ),
  (
    3,
    'Order Pending',
    'Your order #3 is pending payment confirmation.',
    'warning',
    false
  ),
  (
    4,
    'New Products',
    'Check out our latest collection of summer clothing!',
    'promo',
    false
  );

-- Insert cart items
INSERT INTO
  cart_items (user_id, product_id, quantity)
VALUES
  (1, 2, 1),
  -- John has MacBook Pro in cart
  (1, 5, 2),
  -- John has 2 Python Programming books in cart
  (2, 1, 1),
  -- Jane has iPhone 13 in cart
  (2, 3, 3),
  -- Jane has 3 Classic T-Shirts in cart
  (4, 4, 1),
  -- Alice has Slim Fit Jeans in cart
  (4, 5, 1);

-- Insert system logs
INSERT INTO
  system_logs (
    log_level,
    module,
    action,
    user_id,
    ip_address,
    user_agent,
    details
  )
VALUES
  (
    'INFO',
    'auth',
    'user_login',
    1,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    '{"login_method": "email"}'
  ),
  (
    'INFO',
    'orders',
    'order_created',
    1,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    '{"order_id": 1, "total": 1019.98}'
  ),
  (
    'INFO',
    'auth',
    'user_login',
    2,
    '10.0.0.50',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    '{"login_method": "email"}'
  ),
  (
    'WARN',
    'orders',
    'payment_failed',
    3,
    '203.0.113.25',
    'Mozilla/5.0 (X11; Linux x86_64)',
    '{"order_id": 3, "reason": "insufficient_funds"}'
  ),
  (
    'INFO',
    'products',
    'product_viewed',
    2,
    '10.0.0.50',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    '{"product_id": 1}'
  ),
  (
    'ERROR',
    'system',
    'database_connection_failed',
    NULL,
    '127.0.0.1',
    'Internal Service',
    '{"error": "connection_timeout", "retry_count": 3}'
  ),
  (
    'INFO',
    'auth',
    'user_logout',
    1,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    '{"session_duration": "00:45:30"}'
  );

-- Alice has Python Programming book in cart
-- Create additional schemas for testing multi-schema support
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE SCHEMA IF NOT EXISTS inventory;

-- Create tables in analytics schema
CREATE TABLE analytics.page_views (
  id SERIAL PRIMARY KEY,
  page_url VARCHAR(255) NOT NULL,
  user_id INTEGER,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_id VARCHAR(100)
);

CREATE TABLE analytics.events (
  id SERIAL PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  user_id INTEGER,
  event_data JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create tables in inventory schema
CREATE TABLE inventory.warehouses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location VARCHAR(255),
  capacity INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory.stock_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER,
  warehouse_id INTEGER REFERENCES inventory.warehouses(id),
  movement_type VARCHAR(20) CHECK (movement_type IN ('IN', 'OUT')),
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data for the new schemas
INSERT INTO
  analytics.page_views (page_url, user_id, session_id)
VALUES
  ('/home', 1, 'sess_001'),
  ('/products', 1, 'sess_001'),
  ('/home', 2, 'sess_002'),
  ('/checkout', 1, 'sess_001');

INSERT INTO
  analytics.events (event_name, user_id, event_data)
VALUES
  ('login', 1, '{"method": "email"}'),
  ('purchase', 1, '{"amount": 1019.98, "items": 2}'),
  ('logout', 1, '{}');

INSERT INTO
  inventory.warehouses (name, location, capacity)
VALUES
  ('Main Warehouse', 'New York, USA', 10000),
  ('Secondary Warehouse', 'Los Angeles, USA', 5000);

INSERT INTO
  inventory.stock_movements (
    product_id,
    warehouse_id,
    movement_type,
    quantity
  )
VALUES
  (1, 1, 'IN', 100),
  (2, 1, 'IN', 50),
  (1, 1, 'OUT', 5),
  (3, 2, 'IN', 200);
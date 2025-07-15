#!/usr/bin/env python3

import pyodbc
import time
import os
import sys

def wait_for_sql_server():
    """Wait for SQL Server to be ready for connections"""
    max_attempts = 60
    attempt = 1
    
    while attempt <= max_attempts:
        try:
            # Test connection
            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER=localhost;"
                f"UID=sa;"
                f"PWD={os.environ.get('MSSQL_SA_PASSWORD', 'yourStrong(!)Password')}"
            )
            
            conn = pyodbc.connect(conn_str, timeout=5)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            conn.close()
            
            print("SQL Server is ready!")
            return True
            
        except Exception as e:
            print(f"SQL Server not ready yet... (attempt {attempt}/{max_attempts}): {str(e)}")
            attempt += 1
            time.sleep(2)
    
    print("Failed to connect to SQL Server after maximum attempts")
    return False

def execute_sql_file(file_path):
    """Execute SQL commands from a file"""
    try:
        # Read the SQL file
        with open(file_path, 'r') as file:
            sql_content = file.read()
        
        # Connect to SQL Server (master database first)
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER=localhost;"
            f"UID=sa;"
            f"PWD={os.environ.get('MSSQL_SA_PASSWORD', 'yourStrong(!)Password')};"
            f"DATABASE=master"
        )
        
        conn = pyodbc.connect(conn_str)
        conn.autocommit = True  # Enable autocommit for CREATE DATABASE
        cursor = conn.cursor()
        
        # First, create the database
        try:
            cursor.execute("CREATE DATABASE testdb")
            print("Database 'testdb' created successfully")
        except Exception as e:
            print(f"Database creation info: {str(e)}")
        
        cursor.close()
        conn.close()
        
        # Now connect to the testdb database
        conn_str_testdb = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER=localhost;"
            f"UID=sa;"
            f"PWD={os.environ.get('MSSQL_SA_PASSWORD', 'yourStrong(!)Password')};"
            f"DATABASE=testdb"
        )
        
        conn = pyodbc.connect(conn_str_testdb)
        cursor = conn.cursor()
        
        # Process the SQL content - handle the USE statement and parse properly
        lines = sql_content.split('\n')
        processed_lines = []
        
        for line in lines:
            # Skip CREATE DATABASE and USE statements since we handle them differently
            if (not line.strip().startswith('CREATE DATABASE') and 
                not line.strip().startswith('USE ') and 
                line.strip()):
                processed_lines.append(line)
        
        # Join lines back and split by 'GO' statements properly
        sql_content = '\n'.join(processed_lines)
        
        # Split by GO statements (SQL Server batch separator)
        batches = []
        current_batch = []
        
        for line in sql_content.split('\n'):
            line = line.strip()
            if line.upper() == 'GO':
                if current_batch:
                    batches.append('\n'.join(current_batch))
                    current_batch = []
            elif line and not line.startswith('--'):  # Skip comments
                current_batch.append(line)
        
        # Add the last batch if there's content
        if current_batch:
            batches.append('\n'.join(current_batch))
        
        # If no GO statements found, we need to manually split for SQL Server batch requirements
        if len(batches) <= 1 and batches:
            # Split the content more intelligently for SQL Server batching rules
            single_batch = batches[0] if batches else sql_content
            batches = []
            current_batch = []
            lines = single_batch.split('\n')
            
            i = 0
            while i < len(lines):
                line = lines[i].strip()
                
                # Check if this is a statement that needs its own batch
                if (line.startswith('CREATE TRIGGER') or 
                    line.startswith('CREATE PROCEDURE') or
                    line.startswith('CREATE FUNCTION')):
                    
                    # Close current batch if it has content
                    if current_batch:
                        batches.append('\n'.join(current_batch))
                        current_batch = []
                    
                    # Start new batch for this statement
                    # Find all lines until the next major statement
                    trigger_batch = [line]
                    i += 1
                    while i < len(lines):
                        next_line = lines[i].strip()
                        if (next_line.startswith('CREATE ') and 
                            not next_line.startswith('CREATE INDEX')):
                            break
                        trigger_batch.append(lines[i])
                        i += 1
                    
                    batches.append('\n'.join(trigger_batch))
                    i -= 1  # Step back one since we'll increment at the end
                else:
                    current_batch.append(lines[i])
                
                i += 1
            
            # Add final batch if it has content
            if current_batch:
                batches.append('\n'.join(current_batch))
        
        # Execute each batch
        for i, batch in enumerate(batches):
            if batch.strip():
                try:
                    print(f"Executing batch {i+1}/{len(batches)}")
                    cursor.execute(batch)
                    conn.commit()
                    print(f"Batch {i+1} executed successfully")
                except Exception as e:
                    print(f"Error executing batch {i+1}: {str(e)}")
                    print(f"Batch content (first 300 chars): {batch[:300]}...")
                    # Continue with next batch
        
        cursor.close()
        conn.close()
        
        print("Database initialization completed successfully!")
        return True
        
    except Exception as e:
        print(f"Database initialization failed: {str(e)}")
        return False

if __name__ == "__main__":
    print("Starting MSSQL database initialization...")
    
    # Wait for SQL Server to be ready
    if not wait_for_sql_server():
        sys.exit(1)
    
    # Execute initialization script
    sql_file = "/usr/src/app/mssql-init.sql"
    if os.path.exists(sql_file):
        if execute_sql_file(sql_file):
            print("Initialization completed successfully!")
        else:
            print("Initialization failed!")
            sys.exit(1)
    else:
        print(f"SQL file not found: {sql_file}")
        sys.exit(1) 
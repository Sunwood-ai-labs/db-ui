#!/bin/bash

# Start SQL Server in the background
/opt/mssql/bin/sqlservr &

# Run the Python initialization script
python3 /usr/src/app/mssql-init.py &

# Keep the container running by waiting for the SQL Server process
wait 
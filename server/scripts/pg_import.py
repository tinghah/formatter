"""
PostgreSQL CSV Import Script
Called by the Excel Formatter backend to import CSV files into PostgreSQL.

Usage:
  python pg_import.py <config_json_path>

Config JSON format:
{
  "connection": { "host": "...", "port": 5432, "database": "...", "username": "...", "password": "..." },
  "action": "test" | null,
  "imports": [ { "file": "path/to/file.csv", "tableName": "table_name" } ]
}
"""

import sys
import json
import csv
import os

try:
    import psycopg2
except ImportError:
    print(json.dumps({"success": False, "error": "psycopg2 not installed. Run: pip install psycopg2-binary"}))
    sys.exit(1)


def get_connection(config):
    """Create a PostgreSQL connection from config."""
    conn = psycopg2.connect(
        host=config['host'],
        port=config.get('port', 5432),
        dbname=config['database'],
        user=config['username'],
        password=config['password']
    )
    return conn


def test_connection(config):
    """Test PostgreSQL connection."""
    try:
        conn = get_connection(config)
        cur = conn.cursor()
        cur.execute("SELECT version();")
        version = cur.fetchone()[0]
        cur.close()
        conn.close()
        return {"success": True, "message": f"Connected successfully", "version": version}
    except Exception as e:
        return {"success": False, "error": str(e)}


def infer_column_type(values):
    """Infer PostgreSQL column type from sample values."""
    non_empty = [v for v in values if v.strip()]
    if not non_empty:
        return "TEXT"

    is_int = all(v.strip().lstrip('-').isdigit() for v in non_empty)
    if is_int:
        max_val = max(abs(int(v.strip())) for v in non_empty)
        if max_val < 32768:
            return "SMALLINT"
        elif max_val < 2147483648:
            return "INTEGER"
        return "BIGINT"

    is_float = True
    for v in non_empty:
        try:
            float(v.strip())
        except ValueError:
            is_float = False
            break
    if is_float:
        return "NUMERIC"

    max_len = max(len(v) for v in non_empty)
    if max_len <= 255:
        return f"VARCHAR({max(max_len * 2, 50)})"
    return "TEXT"


def import_csv(conn, csv_path, table_name):
    """Import a CSV file into PostgreSQL."""
    if not os.path.exists(csv_path):
        return {"table": table_name, "success": False, "error": f"File not found: {csv_path}"}

    cur = conn.cursor()

    try:
        # Read CSV headers and sample data
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            headers = next(reader)
            rows = list(reader)

        if not headers:
            return {"table": table_name, "success": False, "error": "Empty CSV file"}

        # Clean column names
        clean_headers = []
        for h in headers:
            clean = ''.join(c if c.isalnum() or c == '_' else '_' for c in h.strip().lower())
            if not clean or clean[0].isdigit():
                clean = 'col_' + clean
            clean_headers.append(clean)

        # Infer types from sample data
        sample_size = min(100, len(rows))
        col_types = []
        for i in range(len(clean_headers)):
            sample_values = [rows[j][i] if i < len(rows[j]) else '' for j in range(sample_size)]
            col_types.append(infer_column_type(sample_values))

        # Create table
        cols_def = ', '.join(f'"{h}" {t}' for h, t in zip(clean_headers, col_types))
        create_sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" ({cols_def});'
        cur.execute(create_sql)

        # Insert data using COPY for performance
        with open(csv_path, 'r', encoding='utf-8') as f:
            # Skip header
            next(f)
            cur.copy_expert(
                f'COPY "{table_name}" ({", ".join(f\'"{h}\'' for h in clean_headers)}) FROM STDIN WITH CSV',
                f
            )

        conn.commit()
        return {
            "table": table_name,
            "success": True,
            "rows_imported": len(rows),
            "columns": len(clean_headers),
        }

    except Exception as e:
        conn.rollback()
        return {"table": table_name, "success": False, "error": str(e)}
    finally:
        cur.close()


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No config file specified"}))
        sys.exit(1)

    config_path = sys.argv[1]
    with open(config_path, 'r') as f:
        config = json.load(f)

    conn_config = config['connection']

    # Test connection mode
    if config.get('action') == 'test':
        result = test_connection(conn_config)
        print(json.dumps(result))
        sys.exit(0 if result['success'] else 1)

    # Import mode
    imports = config.get('imports', [])
    if not imports:
        print(json.dumps({"success": False, "error": "No files to import"}))
        sys.exit(1)

    try:
        conn = get_connection(conn_config)
    except Exception as e:
        print(json.dumps({"success": False, "error": f"Connection failed: {str(e)}"}))
        sys.exit(1)

    results = []
    for imp in imports:
        result = import_csv(conn, imp['file'], imp['tableName'])
        results.append(result)

    conn.close()

    all_success = all(r['success'] for r in results)
    total_rows = sum(r.get('rows_imported', 0) for r in results)

    output = {
        "success": all_success,
        "tables_processed": len(results),
        "total_rows_imported": total_rows,
        "results": results,
    }
    print(json.dumps(output))
    sys.exit(0 if all_success else 1)


if __name__ == '__main__':
    main()

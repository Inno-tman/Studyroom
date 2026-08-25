using System.Data;
using System.Data.Common;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using MySql.Data.MySqlClient;
using Npgsql;
using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public class SchemaService : ISchemaService
{
    private DbConnection CreateConnection(string connectionString, DatabaseType dbType) => dbType switch
    {
        DatabaseType.SqlServer => new SqlConnection(connectionString),
        DatabaseType.PostgreSQL => new NpgsqlConnection(connectionString),
        DatabaseType.MySQL => new MySqlConnection(connectionString),
        DatabaseType.SQLite => new SqliteConnection(connectionString),
        _ => throw new ArgumentOutOfRangeException(nameof(dbType))
    };

    public async Task<List<TableSchema>> GetSchemaAsync(string connectionString, DatabaseType dbType)
    {
        using var connection = CreateConnection(connectionString, dbType);
        await connection.OpenAsync();

        if (dbType == DatabaseType.SQLite)
            return await GetSqliteSchemaAsync(connection);

        return await GetStandardSchemaAsync(connection, dbType);
    }

    private async Task<List<TableSchema>> GetStandardSchemaAsync(DbConnection connection, DatabaseType dbType)
    {
        var schemaFilter = dbType == DatabaseType.MySQL ? "DATABASE()" : "CURRENT_SCHEMA";

        var tables = (await connection.QueryAsync<(string Schema, string Name)>($@"
            SELECT TABLE_SCHEMA, TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_TYPE = 'BASE TABLE'
            AND TABLE_SCHEMA = {schemaFilter}
            ORDER BY TABLE_NAME")).ToList();

        var result = new List<TableSchema>();

        foreach (var t in tables)
        {
            var columns = (await connection.QueryAsync<(string Name, string Type, bool Nullable, bool IsPk)>($@"
                SELECT 
                    c.COLUMN_NAME,
                    c.DATA_TYPE,
                    CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END,
                    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku 
                        ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                        AND tc.TABLE_SCHEMA = ku.TABLE_SCHEMA
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                ) pk ON c.TABLE_SCHEMA = pk.TABLE_SCHEMA 
                    AND c.TABLE_NAME = pk.TABLE_NAME 
                    AND c.COLUMN_NAME = pk.COLUMN_NAME
                WHERE c.TABLE_SCHEMA = '{t.Schema}' AND c.TABLE_NAME = '{t.Name}'
                ORDER BY c.ORDINAL_POSITION")).ToList();

            result.Add(new TableSchema
            {
                SchemaName = t.Schema,
                TableName = t.Name,
                Columns = columns.Select(c => new ColumnSchema
                {
                    Name = c.Name,
                    DataType = c.Type,
                    IsNullable = c.Nullable,
                    IsPrimaryKey = c.IsPk
                }).ToList()
            });
        }

        return result;
    }

    private async Task<List<TableSchema>> GetSqliteSchemaAsync(DbConnection connection)
    {
        var tableNames = (await connection.QueryAsync<string>(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).ToList();

        var result = new List<TableSchema>();

        foreach (var name in tableNames)
        {
            var columns = await connection.QueryAsync<SqliteColumnInfo>(
                $"PRAGMA table_info(\"{name}\")");

            result.Add(new TableSchema
            {
                TableName = name,
                Columns = columns.Select(c => new ColumnSchema
                {
                    Name = c.name,
                    DataType = c.type,
                    IsNullable = c.notnull == 0,
                    IsPrimaryKey = c.pk == 1
                }).ToList()
            });
        }

        return result;
    }

    private class SqliteColumnInfo
    {
        public int cid { get; set; }
        public string name { get; set; } = "";
        public string type { get; set; } = "";
        public int notnull { get; set; }
        public object? dflt_value { get; set; }
        public int pk { get; set; }
    }

    public string FormatSchemaForPrompt(List<TableSchema> tables)
    {
        var sb = new System.Text.StringBuilder();

        foreach (var table in tables)
        {
            var fullName = string.IsNullOrEmpty(table.SchemaName)
                ? table.TableName
                : $"{table.SchemaName}.{table.TableName}";

            sb.AppendLine($"Table: {fullName}");
            foreach (var col in table.Columns)
            {
                var pk = col.IsPrimaryKey ? " [PK]" : "";
                var nullable = col.IsNullable ? " NULL" : " NOT NULL";
                sb.AppendLine($"  - {col.Name} ({col.DataType}{nullable}{pk})");
            }
            sb.AppendLine();
        }

        return sb.ToString();
    }
}

using System.Data;
using System.Data.Common;
using Dapper;
using Microsoft.Data.SqlClient;
using Microsoft.Data.Sqlite;
using MySql.Data.MySqlClient;
using Npgsql;
using ReportGenerator.Wpf.Models;

namespace ReportGenerator.Wpf.Services;

public class DatabaseService : IDatabaseService
{
    public string GetProviderName(DatabaseType dbType) => dbType switch
    {
        DatabaseType.SqlServer => "Microsoft.Data.SqlClient",
        DatabaseType.PostgreSQL => "Npgsql",
        DatabaseType.MySQL => "MySql.Data",
        DatabaseType.SQLite => "Microsoft.Data.Sqlite",
        _ => throw new ArgumentOutOfRangeException(nameof(dbType))
    };

    private DbConnection CreateConnection(string connectionString, DatabaseType dbType) => dbType switch
    {
        DatabaseType.SqlServer => new SqlConnection(connectionString),
        DatabaseType.PostgreSQL => new NpgsqlConnection(connectionString),
        DatabaseType.MySQL => new MySqlConnection(connectionString),
        DatabaseType.SQLite => new SqliteConnection(connectionString),
        _ => throw new ArgumentOutOfRangeException(nameof(dbType))
    };

    public async Task<bool> TestConnectionAsync(string connectionString, DatabaseType dbType)
    {
        try
        {
            using var connection = CreateConnection(connectionString, dbType);
            await connection.OpenAsync();
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<Dictionary<string, object?>>> ExecuteQueryAsync(
        string connectionString, DatabaseType dbType, string sql, int maxRows = 10000)
    {
        using var connection = CreateConnection(connectionString, dbType);
        await connection.OpenAsync();

        var result = new List<Dictionary<string, object?>>();
        var columnNames = new List<string>();

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.CommandType = CommandType.Text;

        await using var reader = await command.ExecuteReaderAsync();
        var schemaTable = await reader.GetSchemaTableAsync();

        if (schemaTable != null)
        {
            foreach (DataRow row in schemaTable.Rows)
            {
                columnNames.Add(row["ColumnName"]?.ToString() ?? "");
            }
        }
        else
        {
            for (int i = 0; i < reader.FieldCount; i++)
                columnNames.Add(reader.GetName(i));
        }

        int count = 0;
        while (await reader.ReadAsync() && count < maxRows)
        {
            var row = new Dictionary<string, object?>();
            foreach (var col in columnNames)
            {
                var value = reader[col];
                row[col] = value == DBNull.Value ? null : value;
            }
            result.Add(row);
            count++;
        }

        return result;
    }
}

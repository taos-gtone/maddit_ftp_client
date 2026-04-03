using System.IO;
using System.Text.Json;
using FTPClient.Models;

namespace FTPClient.Services;

public class ProfileService
{
    private readonly string _filePath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    public ProfileService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "FTPClient");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "profiles.json");
    }

    public List<ConnectionProfile> Load()
    {
        if (!File.Exists(_filePath))
            return new List<ConnectionProfile>();

        var json = File.ReadAllText(_filePath);
        return JsonSerializer.Deserialize<List<ConnectionProfile>>(json, JsonOptions)
               ?? new List<ConnectionProfile>();
    }

    public void Save(List<ConnectionProfile> profiles)
    {
        var json = JsonSerializer.Serialize(profiles, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}

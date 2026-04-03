using System.IO;
using System.Text.Json;
using FTPClient.Models;

namespace FTPClient.Services;

public class BookmarkService
{
    private readonly string _filePath;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };

    public BookmarkService()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        var dir = Path.Combine(appData, "FTPClient");
        Directory.CreateDirectory(dir);
        _filePath = Path.Combine(dir, "bookmarks.json");
    }

    public List<Bookmark> Load()
    {
        if (!File.Exists(_filePath))
            return new List<Bookmark>();

        var json = File.ReadAllText(_filePath);
        return JsonSerializer.Deserialize<List<Bookmark>>(json, JsonOptions)
               ?? new List<Bookmark>();
    }

    public void Save(List<Bookmark> bookmarks)
    {
        var json = JsonSerializer.Serialize(bookmarks, JsonOptions);
        File.WriteAllText(_filePath, json);
    }
}

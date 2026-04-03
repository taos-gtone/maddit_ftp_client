using System.IO;
using FTPClient.Models;

namespace FTPClient.Services;

public class LocalFileService
{
    public IReadOnlyList<FileItem> ListDirectory(string path)
    {
        var result = new List<FileItem>();
        var dirInfo = new DirectoryInfo(path);

        foreach (var dir in dirInfo.GetDirectories())
        {
            try
            {
                result.Add(new FileItem
                {
                    Name = dir.Name,
                    FullPath = dir.FullName,
                    IsDirectory = true,
                    Size = 0,
                    LastModified = dir.LastWriteTime
                });
            }
            catch (UnauthorizedAccessException) { }
        }

        foreach (var file in dirInfo.GetFiles())
        {
            try
            {
                result.Add(new FileItem
                {
                    Name = file.Name,
                    FullPath = file.FullName,
                    IsDirectory = false,
                    Size = file.Length,
                    LastModified = file.LastWriteTime
                });
            }
            catch (UnauthorizedAccessException) { }
        }

        return result.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.Name).ToList();
    }

    public IReadOnlyList<string> GetDrives()
    {
        return DriveInfo.GetDrives()
            .Where(d => d.IsReady)
            .Select(d => d.RootDirectory.FullName)
            .ToList();
    }

    public void CreateDirectory(string path) => Directory.CreateDirectory(path);

    public void Delete(string path, bool isDirectory)
    {
        if (isDirectory)
            Directory.Delete(path, true);
        else
            File.Delete(path);
    }

    public void Rename(string oldPath, string newPath)
    {
        if (Directory.Exists(oldPath))
            Directory.Move(oldPath, newPath);
        else
            File.Move(oldPath, newPath);
    }
}

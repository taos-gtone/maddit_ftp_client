using FTPClient.Models;

namespace FTPClient.Services;

public interface IRemoteFileService : IDisposable
{
    bool IsConnected { get; }
    event EventHandler<string>? StatusMessage;

    Task ConnectAsync(ConnectionProfile profile, CancellationToken ct = default);
    Task DisconnectAsync();

    Task<IReadOnlyList<FileItem>> ListDirectoryAsync(string remotePath, CancellationToken ct = default);
    Task<string> GetWorkingDirectoryAsync();
    Task CreateDirectoryAsync(string remotePath, CancellationToken ct = default);
    Task DeleteDirectoryAsync(string remotePath, CancellationToken ct = default);
    Task DeleteFileAsync(string remotePath, CancellationToken ct = default);
    Task RenameAsync(string oldPath, string newPath, CancellationToken ct = default);

    Task DownloadFileAsync(string remotePath, string localPath,
        Action<long, long>? progress = null, CancellationToken ct = default);
    Task UploadFileAsync(string localPath, string remotePath,
        Action<long, long>? progress = null, CancellationToken ct = default);

    Task<long> GetFileSizeAsync(string remotePath, CancellationToken ct = default);
    Task EnsureDirectoryAsync(string remotePath, CancellationToken ct = default);
}

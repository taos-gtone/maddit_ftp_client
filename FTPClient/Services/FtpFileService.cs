using FluentFTP;
using FTPClient.Models;

namespace FTPClient.Services;

public class FtpFileService : IRemoteFileService
{
    private AsyncFtpClient? _client;

    public bool IsConnected => _client?.IsConnected ?? false;
    public event EventHandler<string>? StatusMessage;

    private void Log(string message) => StatusMessage?.Invoke(this, message);

    public async Task ConnectAsync(ConnectionProfile profile, CancellationToken ct = default)
    {
        _client = new AsyncFtpClient(profile.Host, profile.Username, profile.Password, profile.Port);

        // Binary mode - no line ending conversion
        _client.Config.UploadDataType = FtpDataType.Binary;
        _client.Config.DownloadDataType = FtpDataType.Binary;
        _client.Config.EncryptionMode = FtpEncryptionMode.Auto;

        Log($"FTP 연결 중: {profile.Host}:{profile.Port}");
        await _client.Connect(ct);
        Log($"FTP 연결 완료: {profile.Host}");
    }

    public async Task DisconnectAsync()
    {
        if (_client != null)
        {
            await _client.Disconnect();
            Log("FTP 연결 해제");
        }
    }

    public async Task<IReadOnlyList<FileItem>> ListDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");

        var items = await _client.GetListing(remotePath, FtpListOption.Modify | FtpListOption.Size, ct);
        var result = new List<FileItem>();

        foreach (var item in items)
        {
            if (item.Name == "." || item.Name == "..") continue;
            result.Add(new FileItem
            {
                Name = item.Name,
                FullPath = item.FullName,
                IsDirectory = item.Type == FtpObjectType.Directory,
                Size = item.Size,
                LastModified = item.Modified,
                Permissions = item.RawPermissions ?? ""
            });
        }

        return result.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.Name).ToList();
    }

    public async Task<string> GetWorkingDirectoryAsync()
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        return await _client.GetWorkingDirectory();
    }

    public async Task CreateDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        await _client.CreateDirectory(remotePath, ct);
        Log($"디렉토리 생성: {remotePath}");
    }

    public async Task DeleteDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        await _client.DeleteDirectory(remotePath, ct);
        Log($"디렉토리 삭제: {remotePath}");
    }

    public async Task DeleteFileAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        await _client.DeleteFile(remotePath, ct);
        Log($"파일 삭제: {remotePath}");
    }

    public async Task RenameAsync(string oldPath, string newPath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        await _client.Rename(oldPath, newPath, ct);
        Log($"이름 변경: {oldPath} → {newPath}");
    }

    public async Task DownloadFileAsync(string remotePath, string localPath,
        Action<long, long>? progress = null, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");

        Log($"다운로드: {remotePath}");
        long totalSize = await _client.GetFileSize(remotePath, -1, ct);
        var fileProgress = progress != null ? new Progress<FtpProgress>(p =>
        {
            progress((long)p.TransferredBytes, totalSize);
        }) : null;

        await _client.DownloadFile(localPath, remotePath, FtpLocalExists.Overwrite,
            FtpVerify.None, fileProgress, ct);
        Log($"다운로드 완료: {remotePath}");
    }

    public async Task UploadFileAsync(string localPath, string remotePath,
        Action<long, long>? progress = null, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");

        Log($"업로드: {localPath}");
        long totalSize = new System.IO.FileInfo(localPath).Length;
        var fileProgress = progress != null ? new Progress<FtpProgress>(p =>
        {
            progress((long)p.TransferredBytes, totalSize);
        }) : null;

        await _client.UploadFile(localPath, remotePath, FtpRemoteExists.Overwrite,
            true, FtpVerify.None, fileProgress, ct);
        Log($"업로드 완료: {localPath}");
    }

    public async Task<long> GetFileSizeAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        return await _client.GetFileSize(remotePath, -1, ct);
    }

    public async Task EnsureDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        if (_client == null) throw new InvalidOperationException("Not connected");
        if (!await _client.DirectoryExists(remotePath, ct))
            await _client.CreateDirectory(remotePath, true, ct);
    }

    public void Dispose()
    {
        _client?.Dispose();
        _client = null;
    }
}

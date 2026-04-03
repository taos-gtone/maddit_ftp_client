using System.IO;
using Renci.SshNet;
using FTPClient.Models;

namespace FTPClient.Services;

public class SftpFileService : IRemoteFileService
{
    private SftpClient? _client;

    public bool IsConnected => _client?.IsConnected ?? false;
    public event EventHandler<string>? StatusMessage;

    private void Log(string message) => StatusMessage?.Invoke(this, message);

    public Task ConnectAsync(ConnectionProfile profile, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            var authMethods = new List<AuthenticationMethod>();

            if (profile.AuthMethod is AuthMethod.Password or AuthMethod.PasswordAndKey)
            {
                authMethods.Add(new PasswordAuthenticationMethod(profile.Username, profile.Password));
            }

            if (profile.AuthMethod is AuthMethod.PrivateKey or AuthMethod.PasswordAndKey)
            {
                PrivateKeyFile keyFile;
                if (!string.IsNullOrEmpty(profile.PrivateKeyPassphrase))
                    keyFile = new PrivateKeyFile(profile.PrivateKeyPath, profile.PrivateKeyPassphrase);
                else
                    keyFile = new PrivateKeyFile(profile.PrivateKeyPath);

                authMethods.Add(new PrivateKeyAuthenticationMethod(profile.Username, keyFile));
            }

            var connectionInfo = new ConnectionInfo(profile.Host, profile.Port,
                profile.Username, authMethods.ToArray());

            _client = new SftpClient(connectionInfo);
            Log($"SFTP 연결 중: {profile.Host}:{profile.Port}");
            _client.Connect();
            Log($"SFTP 연결 완료: {profile.Host}");
        }, ct);
    }

    public Task DisconnectAsync()
    {
        return Task.Run(() =>
        {
            if (_client != null)
            {
                _client.Disconnect();
                Log("SFTP 연결 해제");
            }
        });
    }

    public Task<IReadOnlyList<FileItem>> ListDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run<IReadOnlyList<FileItem>>(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");

            var items = _client.ListDirectory(remotePath);
            var result = new List<FileItem>();

            foreach (var item in items)
            {
                if (item.Name == "." || item.Name == "..") continue;
                result.Add(new FileItem
                {
                    Name = item.Name,
                    FullPath = item.FullName,
                    IsDirectory = item.IsDirectory,
                    Size = item.Length,
                    LastModified = item.LastWriteTime,
                    Permissions = item.IsDirectory
                        ? $"d{FormatPermissions(item)}"
                        : $"-{FormatPermissions(item)}"
                });
            }

            return result.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.Name).ToList();
        }, ct);
    }

    private static string FormatPermissions(Renci.SshNet.Sftp.ISftpFile file)
    {
        // Simplified permission display
        return "rwxr-xr-x";
    }

    public Task<string> GetWorkingDirectoryAsync()
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            return _client.WorkingDirectory;
        });
    }

    public Task CreateDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            _client.CreateDirectory(remotePath);
            Log($"디렉토리 생성: {remotePath}");
        }, ct);
    }

    public Task DeleteDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            _client.DeleteDirectory(remotePath);
            Log($"디렉토리 삭제: {remotePath}");
        }, ct);
    }

    public Task DeleteFileAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            _client.DeleteFile(remotePath);
            Log($"파일 삭제: {remotePath}");
        }, ct);
    }

    public Task RenameAsync(string oldPath, string newPath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            _client.RenameFile(oldPath, newPath);
            Log($"이름 변경: {oldPath} → {newPath}");
        }, ct);
    }

    public Task DownloadFileAsync(string remotePath, string localPath,
        Action<long, long>? progress = null, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");

            Log($"다운로드: {remotePath}");

            // Get file size for progress reporting
            var attrs = _client.GetAttributes(remotePath);
            var totalSize = attrs.Size;

            using var fileStream = File.Create(localPath);

            if (progress != null)
            {
                // Read in chunks for progress reporting
                using var sftpStream = _client.OpenRead(remotePath);
                var buffer = new byte[81920];
                long totalRead = 0;
                int bytesRead;
                while ((bytesRead = sftpStream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    ct.ThrowIfCancellationRequested();
                    fileStream.Write(buffer, 0, bytesRead);
                    totalRead += bytesRead;
                    progress(totalRead, totalSize);
                }
            }
            else
            {
                _client.DownloadFile(remotePath, fileStream);
            }

            Log($"다운로드 완료: {remotePath}");
        }, ct);
    }

    public Task UploadFileAsync(string localPath, string remotePath,
        Action<long, long>? progress = null, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");

            Log($"업로드: {localPath}");
            var fileInfo = new FileInfo(localPath);
            var totalSize = fileInfo.Length;

            using var fileStream = File.OpenRead(localPath);

            if (progress != null)
            {
                using var sftpStream = _client.Create(remotePath);
                var buffer = new byte[81920];
                long totalWritten = 0;
                int bytesRead;
                while ((bytesRead = fileStream.Read(buffer, 0, buffer.Length)) > 0)
                {
                    ct.ThrowIfCancellationRequested();
                    sftpStream.Write(buffer, 0, bytesRead);
                    totalWritten += bytesRead;
                    progress(totalWritten, totalSize);
                }
            }
            else
            {
                _client.UploadFile(fileStream, remotePath, true);
            }

            Log($"업로드 완료: {localPath}");
        }, ct);
    }

    public Task<long> GetFileSizeAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            var attrs = _client.GetAttributes(remotePath);
            return attrs.Size;
        }, ct);
    }

    public Task EnsureDirectoryAsync(string remotePath, CancellationToken ct = default)
    {
        return Task.Run(() =>
        {
            if (_client == null) throw new InvalidOperationException("Not connected");
            EnsureRemoteDirectory(remotePath);
        }, ct);
    }

    private void EnsureRemoteDirectory(string remotePath)
    {
        if (string.IsNullOrEmpty(remotePath) || remotePath == "/") return;
        if (_client!.Exists(remotePath)) return;

        var lastSlash = remotePath.LastIndexOf('/');
        if (lastSlash > 0)
        {
            var parent = remotePath[..lastSlash];
            if (!string.IsNullOrEmpty(parent))
                EnsureRemoteDirectory(parent);
        }

        _client.CreateDirectory(remotePath);
        Log($"디렉토리 생성: {remotePath}");
    }

    public void Dispose()
    {
        _client?.Dispose();
        _client = null;
    }
}

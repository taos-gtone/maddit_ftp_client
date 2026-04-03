using System.Collections.ObjectModel;
using System.IO;
using FTPClient.Models;
using FTPClient.Services;
using FTPClient.ViewModels.Base;

namespace FTPClient.ViewModels;

public class MainViewModel : ViewModelBase
{
    private IRemoteFileService? _remoteService;
    private readonly TransferService _transferService = new();
    private readonly BookmarkService _bookmarkService = new();
    private string _statusText = "연결 안 됨";
    private string _connectionInfo = "";
    private bool _isConnected;
    private ConnectionProfile? _currentProfile;
    private bool _syncBrowsing;
    private bool _isSyncNavigating; // 재귀 방지 플래그

    // Quick Connect
    private string _quickHost = "";
    private string _quickUsername = "";
    private string _quickPassword = "";
    private int _quickPort = 22;
    private ProtocolType _quickProtocol = ProtocolType.SFTP;

    public LocalPanelViewModel LocalPanel { get; } = new();
    public RemotePanelViewModel RemotePanel { get; } = new();
    public TransferQueueViewModel TransferQueue { get; }
    public ObservableCollection<Bookmark> Bookmarks { get; } = new();

    public string StatusText
    {
        get => _statusText;
        set => SetProperty(ref _statusText, value);
    }

    public string ConnectionInfo
    {
        get => _connectionInfo;
        set => SetProperty(ref _connectionInfo, value);
    }

    public bool IsConnected
    {
        get => _isConnected;
        set => SetProperty(ref _isConnected, value);
    }

    public string QuickHost
    {
        get => _quickHost;
        set => SetProperty(ref _quickHost, value);
    }

    public string QuickUsername
    {
        get => _quickUsername;
        set => SetProperty(ref _quickUsername, value);
    }

    public string QuickPassword
    {
        get => _quickPassword;
        set => SetProperty(ref _quickPassword, value);
    }

    public int QuickPort
    {
        get => _quickPort;
        set => SetProperty(ref _quickPort, value);
    }

    public ProtocolType QuickProtocol
    {
        get => _quickProtocol;
        set
        {
            if (SetProperty(ref _quickProtocol, value))
                QuickPort = value == ProtocolType.SFTP ? 22 : 21;
        }
    }

    public bool SyncBrowsing
    {
        get => _syncBrowsing;
        set
        {
            if (SetProperty(ref _syncBrowsing, value))
                StatusText = value ? "탐색 동기화 활성화" : "탐색 동기화 비활성화";
        }
    }

    public AsyncRelayCommand QuickConnectCommand { get; }
    public AsyncRelayCommand DisconnectCommand { get; }
    public RelayCommand OpenConnectionManagerCommand { get; }
    public RelayCommand AddBookmarkCommand { get; }
    public RelayCommand ToggleSyncBrowsingCommand { get; }
    public RelayCommand ManageBookmarksCommand { get; }

    public MainViewModel()
    {
        TransferQueue = new TransferQueueViewModel(_transferService);

        QuickConnectCommand = new AsyncRelayCommand(QuickConnectAsync,
            () => !string.IsNullOrWhiteSpace(QuickHost));
        DisconnectCommand = new AsyncRelayCommand(DisconnectAsync, () => IsConnected);
        OpenConnectionManagerCommand = new RelayCommand(OpenConnectionManager);
        AddBookmarkCommand = new RelayCommand(AddBookmark, () => IsConnected);
        ToggleSyncBrowsingCommand = new RelayCommand(() => SyncBrowsing = !SyncBrowsing);
        ManageBookmarksCommand = new RelayCommand(ManageBookmarks);

        _transferService.StatusMessage += (_, msg) => StatusText = msg;

        // 탐색 동기화: 로컬 폴더 이동 → 리모트도 동일 이동
        LocalPanel.DirectoryNavigated += (folderName, direction) =>
        {
            if (!SyncBrowsing || !IsConnected || _isSyncNavigating) return;
            _isSyncNavigating = true;
            try
            {
                if (direction == "into")
                {
                    var remotePath = RemotePanel.CurrentPath.TrimEnd('/') + "/" + folderName;
                    _ = RemotePanel.LoadDirectoryAsync(remotePath);
                }
                else if (direction == "up")
                {
                    var current = RemotePanel.CurrentPath.TrimEnd('/');
                    var lastSlash = current.LastIndexOf('/');
                    var parent = lastSlash > 0 ? current[..lastSlash] : "/";
                    _ = RemotePanel.LoadDirectoryAsync(parent);
                }
            }
            finally { _isSyncNavigating = false; }
        };

        // 탐색 동기화: 리모트 폴더 이동 → 로컬도 동일 이동
        RemotePanel.DirectoryNavigated += (folderName, direction) =>
        {
            if (!SyncBrowsing || _isSyncNavigating) return;
            _isSyncNavigating = true;
            try
            {
                if (direction == "into")
                {
                    var localPath = Path.Combine(LocalPanel.CurrentPath, folderName);
                    if (Directory.Exists(localPath))
                        LocalPanel.LoadDirectory(localPath);
                    else
                        StatusText = $"동기화 실패: 로컬에 '{folderName}' 폴더 없음";
                }
                else if (direction == "up")
                {
                    var parent = Directory.GetParent(LocalPanel.CurrentPath);
                    if (parent != null)
                        LocalPanel.LoadDirectory(parent.FullName);
                }
            }
            finally { _isSyncNavigating = false; }
        };

        LoadBookmarks();
    }

    private async Task QuickConnectAsync()
    {
        var profile = new ConnectionProfile
        {
            Name = QuickHost,
            Host = QuickHost,
            Port = QuickPort,
            Protocol = QuickProtocol,
            Username = QuickUsername,
            Password = QuickPassword,
            AuthMethod = AuthMethod.Password
        };

        await ConnectAsync(profile);
    }

    public async Task ConnectAsync(ConnectionProfile profile)
    {
        try
        {
            if (_remoteService != null)
                await DisconnectAsync();

            StatusText = $"연결 중: {profile.Host}:{profile.Port} ({profile.Protocol})...";
            _remoteService = RemoteFileServiceFactory.Create(profile);
            _remoteService.StatusMessage += (_, msg) => StatusText = msg;

            await _remoteService.ConnectAsync(profile);

            _currentProfile = profile;
            IsConnected = true;
            ConnectionInfo = $"{profile.Protocol} - {profile.Username}@{profile.Host}:{profile.Port}";
            StatusText = $"연결됨: {profile.Host}";

            RemotePanel.SetService(_remoteService);

            var initialPath = string.IsNullOrEmpty(profile.InitialRemotePath)
                ? "/" : profile.InitialRemotePath;
            await RemotePanel.LoadDirectoryAsync(initialPath);

            if (!string.IsNullOrEmpty(profile.InitialLocalPath) && Directory.Exists(profile.InitialLocalPath))
                LocalPanel.CurrentPath = profile.InitialLocalPath;
        }
        catch (Exception ex)
        {
            StatusText = $"연결 실패: {ex.Message}";
            IsConnected = false;
            _remoteService?.Dispose();
            _remoteService = null;
            System.Windows.MessageBox.Show($"연결에 실패했습니다:\n{ex.Message}",
                "연결 오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    private async Task DisconnectAsync()
    {
        if (_remoteService != null)
        {
            try
            {
                await _remoteService.DisconnectAsync();
            }
            catch { }
            _remoteService.Dispose();
            _remoteService = null;
        }
        IsConnected = false;
        ConnectionInfo = "";
        StatusText = "연결 안 됨";
        RemotePanel.Disconnect();
        _currentProfile = null;
    }

    private void OpenConnectionManager()
    {
        var dialog = new Views.ConnectionManagerDialog();
        if (dialog.ShowDialog() == true && dialog.SelectedProfile != null)
        {
            _ = ConnectAsync(dialog.SelectedProfile);
        }
    }

    // Transfer operations
    public async Task UploadFileAsync(FileItem localItem)
    {
        if (_remoteService == null || !IsConnected || localItem.IsDirectory) return;

        var remotePath = RemotePanel.CurrentPath.TrimEnd('/') + "/" + localItem.Name;

        // Check if file already exists on remote
        var existingFile = RemotePanel.Files.FirstOrDefault(f => !f.IsDirectory && f.Name == localItem.Name);
        if (existingFile != null)
        {
            var result = System.Windows.MessageBox.Show(
                $"리모트에 '{localItem.Name}' 파일이 이미 존재합니다.\n\n" +
                $"  로컬 크기: {localItem.DisplaySize}  ({localItem.LastModified:yyyy-MM-dd HH:mm})\n" +
                $"  리모트 크기: {existingFile.DisplaySize}  ({existingFile.LastModified:yyyy-MM-dd HH:mm})\n\n" +
                "덮어쓰시겠습니까?",
                "파일 덮어쓰기 확인",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Question);
            if (result != System.Windows.MessageBoxResult.Yes) return;
        }

        var transferItem = new TransferItem
        {
            FileName = localItem.Name,
            LocalPath = localItem.FullPath,
            RemotePath = remotePath,
            Direction = TransferDirection.Upload,
            TotalBytes = localItem.Size
        };

        _transferService.Enqueue(transferItem);
        await _transferService.ProcessQueueAsync(_remoteService);
        await RemotePanel.LoadDirectoryAsync(RemotePanel.CurrentPath);
    }

    public async Task DownloadFileAsync(FileItem remoteItem)
    {
        if (_remoteService == null || !IsConnected || remoteItem.IsDirectory) return;

        var localPath = Path.Combine(LocalPanel.CurrentPath, remoteItem.Name);

        // Check if file already exists locally
        if (File.Exists(localPath))
        {
            var localInfo = new FileInfo(localPath);
            var result = System.Windows.MessageBox.Show(
                $"로컬에 '{remoteItem.Name}' 파일이 이미 존재합니다.\n\n" +
                $"  로컬 크기: {FormatFileSize(localInfo.Length)}  ({localInfo.LastWriteTime:yyyy-MM-dd HH:mm})\n" +
                $"  리모트 크기: {remoteItem.DisplaySize}  ({remoteItem.LastModified:yyyy-MM-dd HH:mm})\n\n" +
                "덮어쓰시겠습니까?",
                "파일 덮어쓰기 확인",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Question);
            if (result != System.Windows.MessageBoxResult.Yes) return;
        }
        var transferItem = new TransferItem
        {
            FileName = remoteItem.Name,
            LocalPath = localPath,
            RemotePath = remoteItem.FullPath,
            Direction = TransferDirection.Download,
            TotalBytes = remoteItem.Size
        };

        _transferService.Enqueue(transferItem);
        await _transferService.ProcessQueueAsync(_remoteService);
        LocalPanel.LoadDirectory(LocalPanel.CurrentPath);
    }

    // Multi-item transfer

    public async Task UploadItemsAsync(IList<FileItem> items)
    {
        if (_remoteService == null || !IsConnected) return;

        var selectedItems = items.OfType<FileItem>().Where(i => !i.IsParentDirectory).ToList();
        if (!selectedItems.Any()) return;

        // 파일 1개면 기존 단일 파일 처리(덮어쓰기 확인 포함)
        if (selectedItems.Count == 1 && !selectedItems[0].IsDirectory)
        {
            await UploadFileAsync(selectedItems[0]);
            return;
        }

        var hasDirectories = selectedItems.Any(i => i.IsDirectory);
        var confirmMsg = hasDirectories
            ? $"{selectedItems.Count}개 항목을 업로드합니다.\n" +
              "폴더는 하위 파일을 포함하여 전송되며 필요한 경우 리모트에 폴더를 생성합니다.\n\n계속하시겠습니까?"
            : $"{selectedItems.Count}개 파일을 업로드합니다.\n\n계속하시겠습니까?";

        if (System.Windows.MessageBox.Show(confirmMsg, "업로드 확인",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Question) != System.Windows.MessageBoxResult.Yes)
            return;

        var filesToTransfer = new List<(string localPath, string remotePath, long size)>();
        var dirsToCreate = new List<string>();
        var remoteBase = RemotePanel.CurrentPath.TrimEnd('/');

        foreach (var item in selectedItems)
        {
            if (item.IsDirectory)
            {
                var remoteDirPath = remoteBase + "/" + item.Name;
                dirsToCreate.Add(remoteDirPath);
                CollectLocalFiles(item.FullPath, remoteDirPath, filesToTransfer, dirsToCreate);
            }
            else
            {
                filesToTransfer.Add((item.FullPath, remoteBase + "/" + item.Name, item.Size));
            }
        }

        try
        {
            if (dirsToCreate.Any())
            {
                StatusText = "폴더 구조 생성 중...";
                foreach (var dir in dirsToCreate)
                    await _remoteService.EnsureDirectoryAsync(dir);
            }

            StatusText = $"{filesToTransfer.Count}개 파일 업로드 중...";
            foreach (var (localPath, remotePath, size) in filesToTransfer)
            {
                _transferService.Enqueue(new TransferItem
                {
                    FileName = Path.GetFileName(localPath),
                    LocalPath = localPath,
                    RemotePath = remotePath,
                    Direction = TransferDirection.Upload,
                    TotalBytes = size
                });
            }

            await _transferService.ProcessQueueAsync(_remoteService);
            await RemotePanel.LoadDirectoryAsync(RemotePanel.CurrentPath);
            StatusText = $"업로드 완료: {filesToTransfer.Count}개 파일";
        }
        catch (Exception ex)
        {
            StatusText = $"업로드 실패: {ex.Message}";
            System.Windows.MessageBox.Show($"업로드 중 오류:\n{ex.Message}",
                "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    public async Task DownloadItemsAsync(IList<FileItem> items)
    {
        if (_remoteService == null || !IsConnected) return;

        var selectedItems = items.OfType<FileItem>().Where(i => !i.IsParentDirectory).ToList();
        if (!selectedItems.Any()) return;

        // 파일 1개면 기존 단일 파일 처리(덮어쓰기 확인 포함)
        if (selectedItems.Count == 1 && !selectedItems[0].IsDirectory)
        {
            await DownloadFileAsync(selectedItems[0]);
            return;
        }

        var hasDirectories = selectedItems.Any(i => i.IsDirectory);
        var confirmMsg = hasDirectories
            ? $"{selectedItems.Count}개 항목을 다운로드합니다.\n" +
              "폴더는 하위 파일을 포함하여 전송되며 필요한 경우 로컬에 폴더를 생성합니다.\n\n계속하시겠습니까?"
            : $"{selectedItems.Count}개 파일을 다운로드합니다.\n\n계속하시겠습니까?";

        if (System.Windows.MessageBox.Show(confirmMsg, "다운로드 확인",
                System.Windows.MessageBoxButton.YesNo,
                System.Windows.MessageBoxImage.Question) != System.Windows.MessageBoxResult.Yes)
            return;

        var filesToTransfer = new List<(string remotePath, string localPath, long size)>();
        var dirsToCreate = new List<string>();
        var localBase = LocalPanel.CurrentPath;

        foreach (var item in selectedItems)
        {
            if (item.IsDirectory)
            {
                var localDirPath = Path.Combine(localBase, item.Name);
                dirsToCreate.Add(localDirPath);
                await CollectRemoteFilesAsync(item.FullPath, localDirPath, filesToTransfer, dirsToCreate);
            }
            else
            {
                filesToTransfer.Add((item.FullPath, Path.Combine(localBase, item.Name), item.Size));
            }
        }

        try
        {
            foreach (var dir in dirsToCreate)
                Directory.CreateDirectory(dir);

            StatusText = $"{filesToTransfer.Count}개 파일 다운로드 중...";
            foreach (var (remotePath, localPath, size) in filesToTransfer)
            {
                _transferService.Enqueue(new TransferItem
                {
                    FileName = Path.GetFileName(localPath),
                    LocalPath = localPath,
                    RemotePath = remotePath,
                    Direction = TransferDirection.Download,
                    TotalBytes = size
                });
            }

            await _transferService.ProcessQueueAsync(_remoteService);
            LocalPanel.LoadDirectory(LocalPanel.CurrentPath);
            StatusText = $"다운로드 완료: {filesToTransfer.Count}개 파일";
        }
        catch (Exception ex)
        {
            StatusText = $"다운로드 실패: {ex.Message}";
            System.Windows.MessageBox.Show($"다운로드 중 오류:\n{ex.Message}",
                "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    private static void CollectLocalFiles(string localDirPath, string remoteDirPath,
        List<(string localPath, string remotePath, long size)> files,
        List<string> dirs)
    {
        try
        {
            foreach (var filePath in Directory.GetFiles(localDirPath))
            {
                files.Add((filePath,
                    remoteDirPath + "/" + Path.GetFileName(filePath),
                    new FileInfo(filePath).Length));
            }
            foreach (var dirPath in Directory.GetDirectories(localDirPath))
            {
                var remoteSubPath = remoteDirPath + "/" + Path.GetFileName(dirPath);
                dirs.Add(remoteSubPath);
                CollectLocalFiles(dirPath, remoteSubPath, files, dirs);
            }
        }
        catch (UnauthorizedAccessException) { }
    }

    private async Task CollectRemoteFilesAsync(string remoteDirPath, string localDirPath,
        List<(string remotePath, string localPath, long size)> files,
        List<string> dirs)
    {
        var items = await _remoteService!.ListDirectoryAsync(remoteDirPath);
        foreach (var item in items)
        {
            if (item.IsDirectory)
            {
                var subLocalPath = Path.Combine(localDirPath, item.Name);
                dirs.Add(subLocalPath);
                await CollectRemoteFilesAsync(item.FullPath, subLocalPath, files, dirs);
            }
            else
            {
                files.Add((item.FullPath, Path.Combine(localDirPath, item.Name), item.Size));
            }
        }
    }

    private static string FormatFileSize(long bytes)
    {
        if (bytes < 1024) return $"{bytes} B";
        if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
        if (bytes < 1024 * 1024 * 1024) return $"{bytes / (1024.0 * 1024):F1} MB";
        return $"{bytes / (1024.0 * 1024 * 1024):F2} GB";
    }

    // Bookmarks
    private void LoadBookmarks()
    {
        Bookmarks.Clear();
        foreach (var b in _bookmarkService.Load())
            Bookmarks.Add(b);
    }

    private void AddBookmark()
    {
        if (!IsConnected) return;

        var dialog = new Views.InputDialog("북마크 추가", "북마크 이름을 입력하세요:");
        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputText))
        {
            var bookmark = new Bookmark
            {
                Name = dialog.InputText,
                ProfileId = _currentProfile?.Id ?? "",
                LocalPath = LocalPanel.CurrentPath,
                RemotePath = RemotePanel.CurrentPath
            };
            Bookmarks.Add(bookmark);
            _bookmarkService.Save(Bookmarks.ToList());
        }
    }

    public async Task NavigateToBookmarkAsync(Bookmark bookmark)
    {
        _isSyncNavigating = true; // 북마크 이동 중 동기화 이벤트 방지
        try
        {
            if (!string.IsNullOrEmpty(bookmark.LocalPath) && Directory.Exists(bookmark.LocalPath))
                LocalPanel.LoadDirectory(bookmark.LocalPath);

            if (IsConnected && !string.IsNullOrEmpty(bookmark.RemotePath))
                await RemotePanel.LoadDirectoryAsync(bookmark.RemotePath);

            // 북마크 활성화 시 탐색 동기화 자동 활성화
            SyncBrowsing = true;
            StatusText = $"북마크 '{bookmark.Name}' - 탐색 동기화 활성화";
        }
        finally { _isSyncNavigating = false; }
    }

    public void DeleteBookmark(Bookmark bookmark)
    {
        Bookmarks.Remove(bookmark);
        _bookmarkService.Save(Bookmarks.ToList());
    }

    private void ManageBookmarks()
    {
        // Open bookmark management - handled via the menu directly
    }
}

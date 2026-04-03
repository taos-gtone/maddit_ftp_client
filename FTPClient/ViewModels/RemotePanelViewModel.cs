using System.Collections.ObjectModel;
using FTPClient.Models;
using FTPClient.Services;
using FTPClient.ViewModels.Base;

namespace FTPClient.ViewModels;

public class RemotePanelViewModel : ViewModelBase
{
    private IRemoteFileService? _service;
    private string _currentPath = "/";
    private FileItem? _selectedItem;
    private bool _isConnected;
    private string _sortColumn = "Name";
    private bool _sortAscending = true;

    public ObservableCollection<FileItem> Files { get; } = new();

    public string CurrentPath
    {
        get => _currentPath;
        set
        {
            if (SetProperty(ref _currentPath, value) && IsConnected)
                _ = LoadDirectoryAsync(value);
        }
    }

    public FileItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

    public bool IsConnected
    {
        get => _isConnected;
        private set => SetProperty(ref _isConnected, value);
    }

    /// <summary>폴더 이동 시 발생. 인자: (이동한 폴더명, 방향: "into"=하위, "up"=상위)</summary>
    public event Action<string, string>? DirectoryNavigated;

    public AsyncRelayCommand RefreshCommand { get; }
    public AsyncRelayCommand NavigateUpCommand { get; }
    public AsyncRelayCommand CreateDirectoryCommand { get; }
    public AsyncRelayCommand DeleteCommand { get; }
    public RelayCommand SortCommand { get; }

    public RemotePanelViewModel()
    {
        RefreshCommand = new AsyncRelayCommand(async () => await LoadDirectoryAsync(_currentPath));
        NavigateUpCommand = new AsyncRelayCommand(NavigateUpAsync);
        CreateDirectoryCommand = new AsyncRelayCommand(CreateDirectoryAsync);
        DeleteCommand = new AsyncRelayCommand(DeleteSelectedAsync,
            () => SelectedItem != null && !SelectedItem.IsParentDirectory && IsConnected);
        SortCommand = new RelayCommand(p => SortBy(p as string ?? "Name"));
    }

    public void SetService(IRemoteFileService service)
    {
        _service = service;
        IsConnected = service.IsConnected;
    }

    public async Task LoadDirectoryAsync(string path)
    {
        if (_service == null || !_service.IsConnected) return;

        try
        {
            var items = await _service.ListDirectoryAsync(path);
            Files.Clear();

            // Add parent directory
            if (path != "/")
            {
                var parentPath = path.TrimEnd('/');
                var lastSlash = parentPath.LastIndexOf('/');
                var parent = lastSlash > 0 ? parentPath[..lastSlash] : "/";
                Files.Add(new FileItem
                {
                    Name = "..",
                    FullPath = parent,
                    IsDirectory = true,
                    IsParentDirectory = true
                });
            }

            var sorted = ApplySort(items);
            foreach (var item in sorted)
                Files.Add(item);

            _currentPath = path;
            OnPropertyChanged(nameof(CurrentPath));
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"리모트 디렉토리를 열 수 없습니다: {ex.Message}",
                "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    public async Task NavigateIntoAsync(FileItem item)
    {
        if (item.IsDirectory)
        {
            var folderName = item.IsParentDirectory ? ".." : item.Name;
            _currentPath = item.FullPath;
            OnPropertyChanged(nameof(CurrentPath));
            await LoadDirectoryAsync(item.FullPath);
            if (item.IsParentDirectory)
                DirectoryNavigated?.Invoke(folderName, "up");
            else
                DirectoryNavigated?.Invoke(folderName, "into");
        }
    }

    private async Task NavigateUpAsync()
    {
        if (_currentPath == "/") return;
        var parentPath = _currentPath.TrimEnd('/');
        var lastSlash = parentPath.LastIndexOf('/');
        var parent = lastSlash > 0 ? parentPath[..lastSlash] : "/";
        _currentPath = parent;
        OnPropertyChanged(nameof(CurrentPath));
        await LoadDirectoryAsync(parent);
        DirectoryNavigated?.Invoke("..", "up");
    }

    private async Task CreateDirectoryAsync()
    {
        if (_service == null) return;

        var dialog = new Views.InputDialog("새 폴더", "폴더 이름을 입력하세요:");
        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputText))
        {
            try
            {
                var newPath = _currentPath.TrimEnd('/') + "/" + dialog.InputText;
                await _service.CreateDirectoryAsync(newPath);
                await LoadDirectoryAsync(_currentPath);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"폴더를 생성할 수 없습니다: {ex.Message}",
                    "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }
    }

    private async Task DeleteSelectedAsync()
    {
        if (_service == null || SelectedItem == null || SelectedItem.IsParentDirectory) return;

        var result = System.Windows.MessageBox.Show(
            $"'{SelectedItem.Name}'을(를) 삭제하시겠습니까?",
            "삭제 확인", System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Warning);

        if (result == System.Windows.MessageBoxResult.Yes)
        {
            try
            {
                if (SelectedItem.IsDirectory)
                    await _service.DeleteDirectoryAsync(SelectedItem.FullPath);
                else
                    await _service.DeleteFileAsync(SelectedItem.FullPath);
                await LoadDirectoryAsync(_currentPath);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"삭제할 수 없습니다: {ex.Message}",
                    "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }
    }

    private void SortBy(string column)
    {
        if (_sortColumn == column)
            _sortAscending = !_sortAscending;
        else
        {
            _sortColumn = column;
            _sortAscending = true;
        }
        _ = LoadDirectoryAsync(_currentPath);
    }

    private IEnumerable<FileItem> ApplySort(IReadOnlyList<FileItem> items)
    {
        IEnumerable<FileItem> sorted = _sortColumn switch
        {
            "Name" => _sortAscending ? items.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.Name)
                                     : items.OrderByDescending(f => f.IsDirectory).ThenByDescending(f => f.Name),
            "Size" => _sortAscending ? items.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.Size)
                                     : items.OrderByDescending(f => f.IsDirectory).ThenByDescending(f => f.Size),
            "Date" => _sortAscending ? items.OrderByDescending(f => f.IsDirectory).ThenBy(f => f.LastModified)
                                     : items.OrderByDescending(f => f.IsDirectory).ThenByDescending(f => f.LastModified),
            _ => items
        };
        return sorted;
    }

    public void Disconnect()
    {
        Files.Clear();
        IsConnected = false;
        _service = null;
        _currentPath = "/";
        OnPropertyChanged(nameof(CurrentPath));
    }
}

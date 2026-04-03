using System.Collections.ObjectModel;
using System.IO;
using FTPClient.Models;
using FTPClient.Services;
using FTPClient.ViewModels.Base;

namespace FTPClient.ViewModels;

public class LocalPanelViewModel : ViewModelBase
{
    private readonly LocalFileService _fileService = new();
    private string _currentPath = "";
    private FileItem? _selectedItem;
    private string _sortColumn = "Name";
    private bool _sortAscending = true;

    public ObservableCollection<FileItem> Files { get; } = new();
    public ObservableCollection<string> Drives { get; } = new();

    public string CurrentPath
    {
        get => _currentPath;
        set
        {
            if (SetProperty(ref _currentPath, value))
                LoadDirectory(value);
        }
    }

    public FileItem? SelectedItem
    {
        get => _selectedItem;
        set => SetProperty(ref _selectedItem, value);
    }

    public string SelectedDrive
    {
        get => Path.GetPathRoot(_currentPath) ?? "C:\\";
        set
        {
            if (!string.IsNullOrEmpty(value))
                CurrentPath = value;
        }
    }

    /// <summary>폴더 이동 시 발생. 인자: (이동한 폴더명, 방향: "into"=하위, "up"=상위)</summary>
    public event Action<string, string>? DirectoryNavigated;

    public RelayCommand NavigateUpCommand { get; }
    public RelayCommand RefreshCommand { get; }
    public RelayCommand NavigateToCommand { get; }
    public RelayCommand CreateDirectoryCommand { get; }
    public RelayCommand DeleteCommand { get; }
    public RelayCommand SortCommand { get; }

    public LocalPanelViewModel()
    {
        NavigateUpCommand = new RelayCommand(NavigateUp);
        RefreshCommand = new RelayCommand(() => LoadDirectory(_currentPath));
        NavigateToCommand = new RelayCommand(p => NavigateTo(p as string));
        CreateDirectoryCommand = new RelayCommand(CreateDirectory);
        DeleteCommand = new RelayCommand(DeleteSelected, () => SelectedItem != null && !SelectedItem.IsParentDirectory);
        SortCommand = new RelayCommand(p => SortBy(p as string ?? "Name"));

        LoadDrives();
        CurrentPath = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
    }

    private void LoadDrives()
    {
        Drives.Clear();
        foreach (var drive in _fileService.GetDrives())
            Drives.Add(drive);
    }

    public void LoadDirectory(string path)
    {
        try
        {
            if (string.IsNullOrEmpty(path) || !Directory.Exists(path))
                return;

            var items = _fileService.ListDirectory(path);
            Files.Clear();

            // Add parent directory entry
            var parentDir = Directory.GetParent(path);
            if (parentDir != null)
            {
                Files.Add(new FileItem
                {
                    Name = "..",
                    FullPath = parentDir.FullName,
                    IsDirectory = true,
                    IsParentDirectory = true
                });
            }

            var sorted = ApplySort(items);
            foreach (var item in sorted)
                Files.Add(item);

            _currentPath = path;
            OnPropertyChanged(nameof(CurrentPath));
            OnPropertyChanged(nameof(SelectedDrive));
        }
        catch (Exception ex)
        {
            System.Windows.MessageBox.Show($"디렉토리를 열 수 없습니다: {ex.Message}",
                "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
        }
    }

    public void NavigateInto(FileItem item)
    {
        if (item.IsDirectory)
        {
            var folderName = item.IsParentDirectory ? ".." : item.Name;
            CurrentPath = item.FullPath;
            if (item.IsParentDirectory)
                DirectoryNavigated?.Invoke(folderName, "up");
            else
                DirectoryNavigated?.Invoke(folderName, "into");
        }
    }

    private void NavigateUp()
    {
        var parent = Directory.GetParent(_currentPath);
        if (parent != null)
        {
            CurrentPath = parent.FullName;
            DirectoryNavigated?.Invoke("..", "up");
        }
    }

    private void NavigateTo(string? path)
    {
        if (!string.IsNullOrEmpty(path) && Directory.Exists(path))
            CurrentPath = path;
    }

    private void CreateDirectory()
    {
        var dialog = new Views.InputDialog("새 폴더", "폴더 이름을 입력하세요:");
        if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputText))
        {
            try
            {
                var newPath = Path.Combine(_currentPath, dialog.InputText);
                _fileService.CreateDirectory(newPath);
                LoadDirectory(_currentPath);
            }
            catch (Exception ex)
            {
                System.Windows.MessageBox.Show($"폴더를 생성할 수 없습니다: {ex.Message}",
                    "오류", System.Windows.MessageBoxButton.OK, System.Windows.MessageBoxImage.Error);
            }
        }
    }

    private void DeleteSelected()
    {
        if (SelectedItem == null || SelectedItem.IsParentDirectory) return;

        var result = System.Windows.MessageBox.Show(
            $"'{SelectedItem.Name}'을(를) 삭제하시겠습니까?",
            "삭제 확인", System.Windows.MessageBoxButton.YesNo, System.Windows.MessageBoxImage.Warning);

        if (result == System.Windows.MessageBoxResult.Yes)
        {
            try
            {
                _fileService.Delete(SelectedItem.FullPath, SelectedItem.IsDirectory);
                LoadDirectory(_currentPath);
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
        LoadDirectory(_currentPath);
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
}

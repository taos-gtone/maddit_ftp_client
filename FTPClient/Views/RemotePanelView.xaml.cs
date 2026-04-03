using System.Linq;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using FTPClient.Models;
using FTPClient.ViewModels;

namespace FTPClient.Views;

public partial class RemotePanelView : UserControl
{
    private string _currentSortColumn = "Name";
    private bool _sortAscending = true;

    public RemotePanelView()
    {
        InitializeComponent();
        UpdateSortArrows();
    }

    private void FileList_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is RemotePanelViewModel vm && vm.SelectedItem is FileItem item)
        {
            if (item.IsDirectory)
                _ = vm.NavigateIntoAsync(item);
            else
                Download_Click(sender, e);
        }
    }

    private void PathBox_KeyDown(object sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && sender is TextBox tb)
        {
            if (DataContext is RemotePanelViewModel vm)
                _ = vm.LoadDirectoryAsync(tb.Text);
        }
    }

    private void ColumnHeader_Click(object sender, RoutedEventArgs e)
    {
        if (e.OriginalSource is GridViewColumnHeader header && header.Column != null)
        {
            var headerText = header.Column.Header?.ToString()?.TrimEnd(' ', '\u25B2', '\u25BC');
            if (headerText == null) return;

            var column = headerText switch
            {
                "이름" => "Name",
                "크기" => "Size",
                "수정일" => "Date",
                _ => null
            };
            if (column == null) return;

            if (_currentSortColumn == column)
                _sortAscending = !_sortAscending;
            else
            {
                _currentSortColumn = column;
                _sortAscending = true;
            }

            if (DataContext is RemotePanelViewModel vm)
                vm.SortCommand.Execute(column);

            UpdateSortArrows();
        }
    }

    private void UpdateSortArrows()
    {
        var arrow = _sortAscending ? " \u25B2" : " \u25BC";

        ColName.Header = _currentSortColumn == "Name" ? "이름" + arrow : "이름";
        ColSize.Header = _currentSortColumn == "Size" ? "크기" + arrow : "크기";
        ColDate.Header = _currentSortColumn == "Date" ? "수정일" + arrow : "수정일";
    }

    private void Download_Click(object sender, RoutedEventArgs e)
    {
        var mainWindow = Window.GetWindow(this);
        if (mainWindow?.DataContext is MainViewModel mainVm)
        {
            var selectedItems = FileListView.SelectedItems.OfType<FileItem>().ToList();
            if (selectedItems.Any())
                _ = mainVm.DownloadItemsAsync(selectedItems);
        }
    }
}

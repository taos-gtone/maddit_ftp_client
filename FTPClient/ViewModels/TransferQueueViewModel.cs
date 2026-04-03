using System.Collections.ObjectModel;
using FTPClient.Models;
using FTPClient.Services;
using FTPClient.ViewModels.Base;

namespace FTPClient.ViewModels;

public class TransferQueueViewModel : ViewModelBase
{
    private readonly TransferService _transferService;

    public ObservableCollection<TransferItem> Transfers => _transferService.Transfers;

    public RelayCommand ClearCompletedCommand { get; }
    public RelayCommand CancelAllCommand { get; }

    public TransferQueueViewModel(TransferService transferService)
    {
        _transferService = transferService;
        ClearCompletedCommand = new RelayCommand(_transferService.ClearCompleted);
        CancelAllCommand = new RelayCommand(_transferService.CancelAll);
    }
}

using System.Collections.Concurrent;
using System.Collections.ObjectModel;
using System.IO;
using System.Windows;
using FTPClient.Models;

namespace FTPClient.Services;

public class TransferService
{
    private readonly ConcurrentQueue<TransferItem> _queue = new();
    private readonly SemaphoreSlim _semaphore = new(1, 1);
    private bool _isProcessing;
    private CancellationTokenSource? _cts;

    public ObservableCollection<TransferItem> Transfers { get; } = new();
    public event EventHandler<string>? StatusMessage;

    public void Enqueue(TransferItem item)
    {
        Application.Current.Dispatcher.Invoke(() => Transfers.Add(item));
        _queue.Enqueue(item);
    }

    public async Task ProcessQueueAsync(IRemoteFileService service)
    {
        if (_isProcessing) return;
        _isProcessing = true;
        _cts = new CancellationTokenSource();

        try
        {
            while (_queue.TryDequeue(out var item))
            {
                await _semaphore.WaitAsync(_cts.Token);
                try
                {
                    item.Status = TransferStatus.InProgress;

                    if (item.Direction == TransferDirection.Download)
                    {
                        await service.DownloadFileAsync(item.RemotePath, item.LocalPath,
                            (transferred, total) =>
                            {
                                Application.Current.Dispatcher.Invoke(() =>
                                {
                                    item.BytesTransferred = transferred;
                                    item.TotalBytes = total;
                                });
                            }, _cts.Token);

                        // Verify file size (binary integrity)
                        var localSize = new FileInfo(item.LocalPath).Length;
                        var remoteSize = await service.GetFileSizeAsync(item.RemotePath, _cts.Token);
                        if (localSize != remoteSize)
                        {
                            StatusMessage?.Invoke(this,
                                $"경고: 파일 크기 불일치 - {item.FileName} (로컬: {localSize}, 리모트: {remoteSize})");
                        }
                    }
                    else
                    {
                        var localSize = new FileInfo(item.LocalPath).Length;
                        await service.UploadFileAsync(item.LocalPath, item.RemotePath,
                            (transferred, total) =>
                            {
                                Application.Current.Dispatcher.Invoke(() =>
                                {
                                    item.BytesTransferred = transferred;
                                    item.TotalBytes = total;
                                });
                            }, _cts.Token);

                        // Verify file size (binary integrity)
                        var remoteSize = await service.GetFileSizeAsync(item.RemotePath, _cts.Token);
                        if (localSize != remoteSize)
                        {
                            StatusMessage?.Invoke(this,
                                $"경고: 파일 크기 불일치 - {item.FileName} (로컬: {localSize}, 리모트: {remoteSize})");
                        }
                    }

                    item.Status = TransferStatus.Completed;
                }
                catch (OperationCanceledException)
                {
                    item.Status = TransferStatus.Failed;
                    item.ErrorMessage = "취소됨";
                    break;
                }
                catch (Exception ex)
                {
                    item.Status = TransferStatus.Failed;
                    item.ErrorMessage = ex.Message;
                    StatusMessage?.Invoke(this, $"전송 실패: {item.FileName} - {ex.Message}");
                }
                finally
                {
                    _semaphore.Release();
                }
            }
        }
        finally
        {
            _isProcessing = false;
        }
    }

    public void CancelAll()
    {
        _cts?.Cancel();
    }

    public void ClearCompleted()
    {
        Application.Current.Dispatcher.Invoke(() =>
        {
            var completed = Transfers.Where(t => t.Status is TransferStatus.Completed or TransferStatus.Failed).ToList();
            foreach (var item in completed)
                Transfers.Remove(item);
        });
    }
}

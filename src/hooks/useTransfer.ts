import { useState, useEffect, useCallback, useRef } from 'react';
import type { TransferItem, TransferProgressData } from '../types/index';

let transferCounter = 0;
function nextTransferId() {
  return 'transfer-' + (++transferCounter) + '-' + Date.now();
}

export function useTransfer() {
  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const queueRef = useRef<TransferItem[]>([]);
  const processingRef = useRef(false);

  useEffect(() => {
    window.electronAPI.onTransferProgress((data: TransferProgressData) => {
      setTransfers(prev => prev.map(t =>
        t.id === data.transferId
          ? { ...t, bytesTransferred: data.bytesTransferred, totalBytes: data.totalBytes, status: data.status, errorMessage: data.errorMessage }
          : t
      ));
    });
    return () => {
      window.electronAPI.removeTransferProgressListener();
    };
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      try {
        if (item.direction === 'upload') {
          await window.electronAPI.uploadFile(item.localPath, item.remotePath, item.id);
        } else {
          await window.electronAPI.downloadFile(item.remotePath, item.localPath, item.id);
        }
      } catch (err: unknown) {
        setTransfers(prev => prev.map(t =>
          t.id === item.id ? { ...t, status: 'failed', errorMessage: (err as Error).message } : t
        ));
      }
    }

    processingRef.current = false;
  }, []);

  const enqueue = useCallback((items: Omit<TransferItem, 'id' | 'bytesTransferred' | 'status' | 'errorMessage'>[]) => {
    const newTransfers: TransferItem[] = items.map(item => ({
      ...item,
      id: nextTransferId(),
      bytesTransferred: 0,
      status: 'queued' as const,
      errorMessage: '',
    }));

    setTransfers(prev => [...prev, ...newTransfers]);
    queueRef.current.push(...newTransfers);
    processQueue();

    return newTransfers;
  }, [processQueue]);

  const clearCompleted = useCallback(() => {
    setTransfers(prev => prev.filter(t => t.status !== 'completed' && t.status !== 'failed'));
  }, []);

  return { transfers, enqueue, clearCompleted };
}

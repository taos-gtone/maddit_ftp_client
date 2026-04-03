import { useState, useCallback } from 'react';
import type { FileItem, SortColumn } from '../types/index';

export function useRemoteFiles() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('/');
  const [isConnected, setIsConnected] = useState(false);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortAscending, setSortAscending] = useState(true);
  const [error, setError] = useState('');

  const applySort = useCallback((items: FileItem[], col: SortColumn, asc: boolean) => {
    const sorted = [...items].sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
      let cmp = 0;
      if (col === 'name') cmp = a.name.localeCompare(b.name);
      else if (col === 'size') cmp = a.size - b.size;
      else if (col === 'date') cmp = new Date(a.lastModified).getTime() - new Date(b.lastModified).getTime();
      return asc ? cmp : -cmp;
    });
    return sorted;
  }, []);

  const loadDirectory = useCallback(async (remotePath: string, col?: SortColumn, asc?: boolean) => {
    try {
      setError('');
      const items = await window.electronAPI.listDirectory(remotePath);
      const sc = col ?? sortColumn;
      const sa = asc ?? sortAscending;
      const sorted = applySort(items, sc, sa);

      const fileList: FileItem[] = [];
      if (remotePath !== '/') {
        const parentPath = remotePath.replace(/\/+$/, '');
        const lastSlash = parentPath.lastIndexOf('/');
        const parent = lastSlash > 0 ? parentPath.substring(0, lastSlash) : '/';
        fileList.push({
          name: '..',
          fullPath: parent,
          isDirectory: true,
          size: 0,
          lastModified: '',
          isParentDirectory: true,
        });
      }
      fileList.push(...sorted);
      setFiles(fileList);
      setCurrentPath(remotePath);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [sortColumn, sortAscending, applySort]);

  const navigateInto = useCallback(async (item: FileItem) => {
    if (!item.isDirectory) return;
    await loadDirectory(item.fullPath);
    return { folderName: item.isParentDirectory ? '..' : item.name, direction: item.isParentDirectory ? 'up' : 'into' };
  }, [loadDirectory]);

  const navigateUp = useCallback(async () => {
    if (currentPath === '/') return false;
    const parentPath = currentPath.replace(/\/+$/, '');
    const lastSlash = parentPath.lastIndexOf('/');
    const parent = lastSlash > 0 ? parentPath.substring(0, lastSlash) : '/';
    await loadDirectory(parent);
    return true;
  }, [currentPath, loadDirectory]);

  const sortBy = useCallback((column: SortColumn) => {
    const newAsc = sortColumn === column ? !sortAscending : true;
    setSortColumn(column);
    setSortAscending(newAsc);
    loadDirectory(currentPath, column, newAsc);
  }, [sortColumn, sortAscending, currentPath, loadDirectory]);

  const createDirectory = useCallback(async (name: string) => {
    const newPath = currentPath.replace(/\/+$/, '') + '/' + name;
    await window.electronAPI.createRemoteDirectory(newPath);
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const deleteItem = useCallback(async (item: FileItem) => {
    if (item.isDirectory) {
      await window.electronAPI.deleteRemoteDirectory(item.fullPath);
    } else {
      await window.electronAPI.deleteRemoteFile(item.fullPath);
    }
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const refresh = useCallback(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const disconnect = useCallback(() => {
    setFiles([]);
    setIsConnected(false);
    setCurrentPath('/');
  }, []);

  return {
    files, currentPath, isConnected, setIsConnected, sortColumn, sortAscending, error,
    loadDirectory, navigateInto, navigateUp, sortBy,
    createDirectory, deleteItem, refresh, disconnect,
  };
}

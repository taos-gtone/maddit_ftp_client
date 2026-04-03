import { useState, useEffect, useCallback } from 'react';
import type { FileItem, SortColumn } from '../types/index';

// Windows 드라이브 루트 보정: "C:" → "C:\"
function normalizePath(p: string): string {
  if (/^[A-Za-z]:$/.test(p)) return p + '\\';
  return p;
}

// 부모 경로 계산
function getParentPath(dirPath: string): string | null {
  const normalized = dirPath.replace(/\\/g, '/').replace(/\/+$/, '');
  // 드라이브 루트 (C:) 이면 부모 없음
  if (/^[A-Za-z]:$/.test(normalized)) return null;
  const lastSlash = normalized.lastIndexOf('/');
  if (lastSlash < 0) return null;
  const parent = normalized.substring(0, lastSlash);
  // 드라이브 루트면 슬래시 붙여주기: "C:" → "C:/"
  const result = /^[A-Za-z]:$/.test(parent) ? parent + '/' : parent;
  return result.replace(/\//g, '\\');
}

export function useLocalFiles() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState('');
  const [drives, setDrives] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>('name');
  const [sortAscending, setSortAscending] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.electronAPI.getDrives().then(setDrives);
    window.electronAPI.getHomePath().then((home) => {
      setCurrentPath(home);
      loadDirectory(home);
    });
  }, []);

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

  const loadDirectory = useCallback(async (dirPath: string, col?: SortColumn, asc?: boolean) => {
    try {
      setError('');
      const safePath = normalizePath(dirPath);
      const items = await window.electronAPI.listLocalDirectory(safePath);
      const sc = col ?? sortColumn;
      const sa = asc ?? sortAscending;
      const sorted = applySort(items, sc, sa);

      const fileList: FileItem[] = [];
      const parentPath = getParentPath(safePath);
      if (parentPath) {
        fileList.push({
          name: '..',
          fullPath: parentPath,
          isDirectory: true,
          size: 0,
          lastModified: '',
          isParentDirectory: true,
        });
      }
      fileList.push(...sorted);
      setFiles(fileList);
      setCurrentPath(safePath);
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
    const parentPath = getParentPath(currentPath);
    if (parentPath) {
      await loadDirectory(parentPath);
      return true;
    }
    return false;
  }, [currentPath, loadDirectory]);

  const sortBy = useCallback((column: SortColumn) => {
    const newAsc = sortColumn === column ? !sortAscending : true;
    setSortColumn(column);
    setSortAscending(newAsc);
    loadDirectory(currentPath, column, newAsc);
  }, [sortColumn, sortAscending, currentPath, loadDirectory]);

  const changeDrive = useCallback((drive: string) => {
    loadDirectory(drive);
  }, [loadDirectory]);

  const createDirectory = useCallback(async (name: string) => {
    const newPath = currentPath.replace(/\\$/, '') + '\\' + name;
    await window.electronAPI.createLocalDirectory(newPath);
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const deleteItem = useCallback(async (item: FileItem) => {
    await window.electronAPI.deleteLocal(item.fullPath, item.isDirectory);
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const refresh = useCallback(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  return {
    files, currentPath, drives, sortColumn, sortAscending, error,
    loadDirectory, navigateInto, navigateUp, sortBy, changeDrive,
    createDirectory, deleteItem, refresh,
  };
}

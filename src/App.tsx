import { useState, useCallback, useEffect, useRef } from 'react';
import TitleBar from './components/TitleBar';
import QuickConnect from './components/QuickConnect';
import FilePanel from './components/FilePanel';
import TransferQueue from './components/TransferQueue';
import ConnectionManager from './components/ConnectionManager';
import InputDialog from './components/InputDialog';
import BannerAd from './components/BannerAd';
import BookmarkEditDialog from './components/BookmarkEditDialog';
import { useLocalFiles } from './hooks/useLocalFiles';
import { useRemoteFiles } from './hooks/useRemoteFiles';
import { useTransfer } from './hooks/useTransfer';
import { useSplitPane } from './hooks/useSplitPane';
import type { ContextMenuAction } from './components/FilePanel';
import type { ConnectionProfile, FileItem, ProtocolType, Bookmark } from './types/index';

export default function App() {
  const local = useLocalFiles();
  const remote = useRemoteFiles();
  const transfer = useTransfer();
  const splitPane = useSplitPane(0.5);

  const [isConnected, setIsConnected] = useState(false);
  const [statusText, setStatusText] = useState('연결 안 됨');
  const [connectionInfo, setConnectionInfo] = useState('');
  const [showConnManager, setShowConnManager] = useState(false);
  const [syncBrowsing, setSyncBrowsing] = useState(false);
  const isSyncNavigatingRef = useRef(false);
  const currentProfileRef = useRef<ConnectionProfile | null>(null);

  // Input dialog state
  const [inputDialog, setInputDialog] = useState({ isOpen: false, title: '', message: '', defaultValue: '', target: '' as 'localDir' | 'remoteDir' });

  // Bookmark edit dialog state
  const [editingBookmark, setEditingBookmark] = useState<Bookmark | null>(null);
  const [bookmarkDialogMode, setBookmarkDialogMode] = useState<'add' | 'edit'>('edit');

  // Menu dropdowns
  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showBookmarkMenu, setShowBookmarkMenu] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);

  // Selections
  const [localSelection, setLocalSelection] = useState<FileItem[]>([]);
  const [remoteSelection, setRemoteSelection] = useState<FileItem[]>([]);

  useEffect(() => {
    window.electronAPI.loadBookmarks().then(setBookmarks);
  }, []);

  function closeAllMenus() {
    setShowFileMenu(false);
    setShowBookmarkMenu(false);
    setShowHelpMenu(false);
  }

  // ─── Connection ───
  const handleConnect = useCallback(async (host: string, port: number, username: string, password: string, protocol: ProtocolType) => {
    const profile: ConnectionProfile = {
      id: '', name: host, host, port, protocol, username, password,
      authMethod: 'password', privateKeyPath: '', privateKeyPassphrase: '',
      initialRemotePath: '/', initialLocalPath: '',
    };
    await connectWithProfile(profile);
  }, []);

  const connectWithProfile = useCallback(async (profile: ConnectionProfile) => {
    try {
      setStatusText(`연결 중: ${profile.host}:${profile.port} (${profile.protocol.toUpperCase()})...`);
      await window.electronAPI.connect(profile);
      setIsConnected(true);
      remote.setIsConnected(true);
      setConnectionInfo(`${profile.protocol.toUpperCase()} - ${profile.username}@${profile.host}:${profile.port}`);
      setStatusText(`연결됨: ${profile.host}`);
      currentProfileRef.current = profile;

      const initialPath = profile.initialRemotePath || '/';
      await remote.loadDirectory(initialPath);

      if (profile.initialLocalPath) {
        const exists = await window.electronAPI.localExists(profile.initialLocalPath);
        if (exists) local.loadDirectory(profile.initialLocalPath);
      }
    } catch (err: unknown) {
      setStatusText(`연결 실패: ${(err as Error).message}`);
      setIsConnected(false);
      remote.setIsConnected(false);
    }
  }, [remote, local]);

  const handleDisconnect = useCallback(async () => {
    try { await window.electronAPI.disconnect(); } catch {}
    setIsConnected(false);
    setConnectionInfo('');
    setStatusText('연결 안 됨');
    remote.disconnect();
    currentProfileRef.current = null;
  }, [remote]);

  // ─── Sync browsing ───
  const handleLocalNavigate = useCallback(async (item: FileItem) => {
    const result = await local.navigateInto(item);
    if (result && syncBrowsing && isConnected && !isSyncNavigatingRef.current) {
      isSyncNavigatingRef.current = true;
      try {
        if (result.direction === 'into') {
          const remotePath = remote.currentPath.replace(/\/+$/, '') + '/' + result.folderName;
          await remote.loadDirectory(remotePath);
        } else if (result.direction === 'up') {
          await remote.navigateUp();
        }
      } catch {} finally { isSyncNavigatingRef.current = false; }
    }
  }, [local, remote, syncBrowsing, isConnected]);

  const handleRemoteNavigate = useCallback(async (item: FileItem) => {
    const result = await remote.navigateInto(item);
    if (result && syncBrowsing && !isSyncNavigatingRef.current) {
      isSyncNavigatingRef.current = true;
      try {
        if (result.direction === 'into') {
          const localPath = local.currentPath.replace(/\\$/, '') + '\\' + result.folderName;
          const exists = await window.electronAPI.localExists(localPath);
          if (exists) local.loadDirectory(localPath);
          else setStatusText(`동기화 실패: 로컬에 '${result.folderName}' 폴더 없음`);
        } else if (result.direction === 'up') {
          await local.navigateUp();
        }
      } catch {} finally { isSyncNavigatingRef.current = false; }
    }
  }, [local, remote, syncBrowsing]);

  // ─── Transfer operations ───
  const handleUpload = useCallback(async () => {
    if (!isConnected) return;
    const items = localSelection.filter(i => !i.isParentDirectory);
    if (items.length === 0) return;

    const remoteBase = remote.currentPath.replace(/\/+$/, '');

    if (items.length === 1 && !items[0].isDirectory) {
      const item = items[0];
      const remotePath = remoteBase + '/' + item.name;
      const existing = remote.files.find(f => !f.isDirectory && f.name === item.name);
      if (existing) {
        const ok = window.confirm(
          `리모트에 '${item.name}' 파일이 이미 존재합니다.\n\n` +
          `  로컬 크기: ${formatSize(item.size)}\n` +
          `  리모트 크기: ${formatSize(existing.size)}\n\n` +
          '덮어쓰시겠습니까?'
        );
        if (!ok) return;
      }
      transfer.enqueue([{ fileName: item.name, localPath: item.fullPath, remotePath, direction: 'upload', totalBytes: item.size }]);
      setStatusText(`업로드: ${item.name}`);
      setTimeout(() => remote.refresh(), 2000);
      return;
    }

    const hasDirectories = items.some(i => i.isDirectory);
    const msg = hasDirectories
      ? `${items.length}개 항목을 업로드합니다.\n폴더는 하위 파일을 포함하여 전송됩니다.\n\n계속하시겠습니까?`
      : `${items.length}개 파일을 업로드합니다.\n\n계속하시겠습니까?`;
    if (!window.confirm(msg)) return;

    const filesToTransfer: { localPath: string; remotePath: string; size: number }[] = [];
    const dirsToCreate: string[] = [];

    for (const item of items) {
      if (item.isDirectory) {
        const remoteDirPath = remoteBase + '/' + item.name;
        dirsToCreate.push(remoteDirPath);
        const collected = await window.electronAPI.collectLocalFiles(item.fullPath);
        for (const dir of collected.dirs) {
          const relPath = dir.replace(item.fullPath, '').replace(/\\/g, '/');
          dirsToCreate.push(remoteDirPath + relPath);
        }
        for (const file of collected.files) {
          const relPath = file.path.replace(item.fullPath, '').replace(/\\/g, '/');
          filesToTransfer.push({ localPath: file.path, remotePath: remoteDirPath + relPath, size: file.size });
        }
      } else {
        filesToTransfer.push({ localPath: item.fullPath, remotePath: remoteBase + '/' + item.name, size: item.size });
      }
    }

    try {
      for (const dir of dirsToCreate) await window.electronAPI.ensureRemoteDirectory(dir);
      setStatusText(`${filesToTransfer.length}개 파일 업로드 중...`);
      transfer.enqueue(filesToTransfer.map(f => ({
        fileName: f.localPath.split(/[/\\]/).pop()!,
        localPath: f.localPath, remotePath: f.remotePath,
        direction: 'upload' as const, totalBytes: f.size,
      })));
      setTimeout(() => { remote.refresh(); setStatusText(`업로드 완료: ${filesToTransfer.length}개 파일`); }, 3000);
    } catch (err: unknown) {
      setStatusText(`업로드 실패: ${(err as Error).message}`);
    }
  }, [isConnected, localSelection, remote, transfer]);

  const handleDownload = useCallback(async () => {
    if (!isConnected) return;
    const items = remoteSelection.filter(i => !i.isParentDirectory);
    if (items.length === 0) return;

    const localBase = local.currentPath;

    if (items.length === 1 && !items[0].isDirectory) {
      const item = items[0];
      const localPath = localBase.replace(/\\$/, '') + '\\' + item.name;
      const exists = await window.electronAPI.localExists(localPath);
      if (exists) {
        const localSize = await window.electronAPI.getLocalFileSize(localPath);
        const ok = window.confirm(
          `로컬에 '${item.name}' 파일이 이미 존재합니다.\n\n` +
          `  로컬 크기: ${formatSize(localSize)}\n` +
          `  리모트 크기: ${formatSize(item.size)}\n\n` +
          '덮어쓰시겠습니까?'
        );
        if (!ok) return;
      }
      transfer.enqueue([{ fileName: item.name, localPath, remotePath: item.fullPath, direction: 'download', totalBytes: item.size }]);
      setStatusText(`다운로드: ${item.name}`);
      setTimeout(() => local.refresh(), 2000);
      return;
    }

    const hasDirectories = items.some(i => i.isDirectory);
    const msg = hasDirectories
      ? `${items.length}개 항목을 다운로드합니다.\n폴더는 하위 파일을 포함하여 전송됩니다.\n\n계속하시겠습니까?`
      : `${items.length}개 파일을 다운로드합니다.\n\n계속하시겠습니까?`;
    if (!window.confirm(msg)) return;

    const filesToTransfer: { remotePath: string; localPath: string; size: number }[] = [];
    const dirsToCreate: string[] = [];

    for (const item of items) {
      if (item.isDirectory) {
        const localDirPath = localBase.replace(/\\$/, '') + '\\' + item.name;
        dirsToCreate.push(localDirPath);
        const collected = await window.electronAPI.listRecursive(item.fullPath);
        for (const dir of collected.dirs) {
          dirsToCreate.push(localDirPath + dir.replace(item.fullPath, '').replace(/\//g, '\\'));
        }
        for (const file of collected.files) {
          filesToTransfer.push({
            remotePath: file.path,
            localPath: localDirPath + file.path.replace(item.fullPath, '').replace(/\//g, '\\'),
            size: file.size,
          });
        }
      } else {
        filesToTransfer.push({
          remotePath: item.fullPath,
          localPath: localBase.replace(/\\$/, '') + '\\' + item.name,
          size: item.size,
        });
      }
    }

    try {
      for (const dir of dirsToCreate) await window.electronAPI.createLocalDirectory(dir);
      setStatusText(`${filesToTransfer.length}개 파일 다운로드 중...`);
      transfer.enqueue(filesToTransfer.map(f => ({
        fileName: f.localPath.split(/[/\\]/).pop()!,
        localPath: f.localPath, remotePath: f.remotePath,
        direction: 'download' as const, totalBytes: f.size,
      })));
      setTimeout(() => { local.refresh(); setStatusText(`다운로드 완료: ${filesToTransfer.length}개 파일`); }, 3000);
    } catch (err: unknown) {
      setStatusText(`다운로드 실패: ${(err as Error).message}`);
    }
  }, [isConnected, remoteSelection, local, remote, transfer]);

  // ─── Directory creation ───
  const handleLocalCreateDir = useCallback(() => {
    setInputDialog({ isOpen: true, title: '새 폴더', message: '폴더 이름을 입력하세요:', defaultValue: '', target: 'localDir' });
  }, []);

  const handleRemoteCreateDir = useCallback(() => {
    setInputDialog({ isOpen: true, title: '새 폴더', message: '폴더 이름을 입력하세요:', defaultValue: '', target: 'remoteDir' });
  }, []);

  const handleInputConfirm = useCallback(async (value: string) => {
    try {
      if (inputDialog.target === 'localDir') {
        await local.createDirectory(value);
      } else if (inputDialog.target === 'remoteDir') {
        await remote.createDirectory(value);
      }
    } catch (err: unknown) {
      setStatusText(`오류: ${(err as Error).message}`);
    }
    setInputDialog(prev => ({ ...prev, isOpen: false }));
  }, [inputDialog.target, local, remote, bookmarks]);

  // ─── Delete ───
  const handleLocalDelete = useCallback(async (items: FileItem[]) => {
    const targets = items.filter(i => !i.isParentDirectory);
    if (targets.length === 0) return;
    const msg = targets.length === 1
      ? `'${targets[0].name}'${targets[0].isDirectory ? ' 폴더와 하위 항목을' : '을(를)'} 삭제하시겠습니까?`
      : `${targets.length}개 항목 (폴더 ${targets.filter(i => i.isDirectory).length}개, 파일 ${targets.filter(i => !i.isDirectory).length}개)을 삭제하시겠습니까?\n\n폴더는 하위 항목을 포함하여 삭제됩니다.`;
    if (!window.confirm(msg)) return;
    for (const item of targets) {
      try { await local.deleteItem(item); } catch (err: unknown) { setStatusText(`삭제 실패: ${(err as Error).message}`); }
    }
  }, [local]);

  const handleRemoteDelete = useCallback(async (items: FileItem[]) => {
    const targets = items.filter(i => !i.isParentDirectory);
    if (targets.length === 0) return;
    const msg = targets.length === 1
      ? `'${targets[0].name}'${targets[0].isDirectory ? ' 폴더와 하위 항목을' : '을(를)'} 삭제하시겠습니까?`
      : `${targets.length}개 항목 (폴더 ${targets.filter(i => i.isDirectory).length}개, 파일 ${targets.filter(i => !i.isDirectory).length}개)을 삭제하시겠습니까?\n\n폴더는 하위 항목을 포함하여 삭제됩니다.`;
    if (!window.confirm(msg)) return;
    for (const item of targets) {
      try { await remote.deleteItem(item); } catch (err: unknown) { setStatusText(`삭제 실패: ${(err as Error).message}`); }
    }
  }, [remote]);

  // ─── Bookmarks ───
  const handleAddBookmark = useCallback(() => {
    if (!isConnected) return;
    setBookmarkDialogMode('add');
    setEditingBookmark({
      id: crypto.randomUUID(),
      name: '',
      profileId: currentProfileRef.current?.id || '',
      localPath: local.currentPath,
      remotePath: remote.currentPath,
      syncBrowsing: false,
    });
    closeAllMenus();
  }, [isConnected, local.currentPath, remote.currentPath]);

  const handleNavigateBookmark = useCallback(async (bookmark: Bookmark) => {
    isSyncNavigatingRef.current = true;
    try {
      if (bookmark.localPath) {
        const exists = await window.electronAPI.localExists(bookmark.localPath);
        if (exists) local.loadDirectory(bookmark.localPath);
      }
      if (isConnected && bookmark.remotePath) await remote.loadDirectory(bookmark.remotePath);
      const sync = bookmark.syncBrowsing ?? true;
      setSyncBrowsing(sync);
      setStatusText(`북마크 '${bookmark.name}' - 탐색 동기화 ${sync ? '활성화' : '비활성화'}`);
    } finally { isSyncNavigatingRef.current = false; }
    closeAllMenus();
  }, [isConnected, local, remote]);

  const handleEditBookmark = useCallback((bookmark: Bookmark) => {
    setBookmarkDialogMode('edit');
    setEditingBookmark(bookmark);
    closeAllMenus();
  }, []);

  const handleSaveBookmark = useCallback(async (saved: Bookmark) => {
    let newBookmarks: Bookmark[];
    if (bookmarkDialogMode === 'add') {
      newBookmarks = [...bookmarks, saved];
    } else {
      newBookmarks = bookmarks.map(b => b.id === saved.id ? saved : b);
    }
    setBookmarks(newBookmarks);
    await window.electronAPI.saveBookmarks(newBookmarks);
    setEditingBookmark(null);
  }, [bookmarks, bookmarkDialogMode]);

  const handleDeleteBookmark = useCallback(async (bookmark: Bookmark) => {
    const updated = bookmarks.filter(b => b.id !== bookmark.id);
    setBookmarks(updated);
    await window.electronAPI.saveBookmarks(updated);
  }, [bookmarks]);

  // ─── Double-click handlers ───
  const handleLocalDoubleClick = useCallback(async (item: FileItem) => {
    if (item.isDirectory) await handleLocalNavigate(item);
    else if (isConnected) { setLocalSelection([item]); handleUpload(); }
  }, [handleLocalNavigate, isConnected, handleUpload]);

  const handleRemoteDoubleClick = useCallback(async (item: FileItem) => {
    if (item.isDirectory) await handleRemoteNavigate(item);
    else { setRemoteSelection([item]); handleDownload(); }
  }, [handleRemoteNavigate, handleDownload]);

  // ─── Context menu definitions ───
  const localContextMenuItems: ContextMenuAction[] = [
    { label: '업로드', action: 'upload', disabled: !isConnected },
    { label: '', action: '', separator: true },
    { label: '새 폴더', action: 'newFolder' },
    { label: '삭제', action: 'delete' },
    { label: '', action: '', separator: true },
    { label: '새로고침', action: 'refresh' },
  ];

  const remoteContextMenuItems: ContextMenuAction[] = [
    { label: '다운로드', action: 'download' },
    { label: '', action: '', separator: true },
    { label: '새 폴더', action: 'newFolder' },
    { label: '삭제', action: 'delete' },
    { label: '', action: '', separator: true },
    { label: '새로고침', action: 'refresh' },
  ];

  const handleLocalContextAction = useCallback(async (action: string, items: FileItem[]) => {
    if (action === 'upload') {
      // 선택된 항목으로 업로드 실행
      setLocalSelection(items);
      // 약간의 딜레이 후 업로드 (선택 상태 반영)
      setTimeout(() => handleUpload(), 0);
    } else if (action === 'newFolder') {
      handleLocalCreateDir();
    } else if (action === 'delete') {
      handleLocalDelete(items);
    } else if (action === 'refresh') {
      local.refresh();
    }
  }, [handleUpload, handleLocalCreateDir, local]);

  const handleRemoteContextAction = useCallback(async (action: string, items: FileItem[]) => {
    if (action === 'download') {
      setRemoteSelection(items);
      setTimeout(() => handleDownload(), 0);
    } else if (action === 'newFolder') {
      handleRemoteCreateDir();
    } else if (action === 'delete') {
      handleRemoteDelete(items);
    } else if (action === 'refresh') {
      remote.refresh();
    }
  }, [handleDownload, handleRemoteCreateDir, remote]);

  const anyMenuOpen = showFileMenu || showBookmarkMenu || showHelpMenu;

  return (
    <div className="h-screen flex flex-col bg-bg overflow-hidden">
      <TitleBar />

      {/* Menu bar: 파일(F) 북마크(B) 도움말(H) */}
      <div className="h-6 bg-surface border-b border-border flex items-center px-1 text-xs select-none shrink-0">
        {/* 파일 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { closeAllMenus(); setShowFileMenu(!showFileMenu); }}
            className={`px-2.5 py-0.5 hover:bg-hover ${showFileMenu ? 'bg-hover' : ''}`}
          >
            파일(F)
          </button>
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-border shadow-lg z-50 w-48 context-menu-enter">
              <button
                onClick={() => { setShowConnManager(true); closeAllMenus(); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover"
              >
                연결 관리자
              </button>
              <div className="h-px bg-border" />
              <button
                onClick={() => { window.electronAPI.closeWindow(); }}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover"
              >
                종료
              </button>
            </div>
          )}
        </div>

        {/* 북마크 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { closeAllMenus(); setShowBookmarkMenu(!showBookmarkMenu); }}
            className={`px-2.5 py-0.5 hover:bg-hover ${showBookmarkMenu ? 'bg-hover' : ''}`}
          >
            북마크(B)
          </button>
          {showBookmarkMenu && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-border shadow-lg z-50 w-56 context-menu-enter">
              <button
                onClick={handleAddBookmark}
                disabled={!isConnected}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover disabled:opacity-50"
              >
                현재 위치 북마크 추가
              </button>
              {bookmarks.length > 0 && <div className="h-px bg-border" />}
              {bookmarks.map(b => (
                <div key={b.id} className="flex items-center hover:bg-hover group">
                  <button
                    onClick={() => handleNavigateBookmark(b)}
                    className="flex-1 text-left px-3 py-1.5 text-xs truncate"
                    title={`로컬: ${b.localPath}\n리모트: ${b.remotePath}`}
                  >
                    {b.name}
                  </button>
                  <button
                    onClick={() => handleEditBookmark(b)}
                    className="px-1.5 text-primary opacity-0 group-hover:opacity-100 text-xs"
                    title="수정"
                  >
                    &#9998;
                  </button>
                  <button
                    onClick={() => handleDeleteBookmark(b)}
                    className="px-1.5 text-error opacity-0 group-hover:opacity-100 text-xs"
                    title="삭제"
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 도움말 메뉴 */}
        <div className="relative">
          <button
            onClick={() => { closeAllMenus(); setShowHelpMenu(!showHelpMenu); }}
            className={`px-2.5 py-0.5 hover:bg-hover ${showHelpMenu ? 'bg-hover' : ''}`}
          >
            도움말(H)
          </button>
          {showHelpMenu && (
            <div className="absolute top-full left-0 mt-0 bg-white border border-border shadow-lg z-50 w-48 context-menu-enter">
              <button
                onClick={() => closeAllMenus()}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-hover"
              >
                Maddit FTP Client v1.0.0
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick Connect toolbar */}
      <QuickConnect
        isConnected={isConnected}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        onOpenConnectionManager={() => setShowConnManager(true)}
      />

      {/* Main panels with resizable splitter */}
      <div ref={splitPane.containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* Local panel */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: splitPane.leftPercent + '%' }}>
          <FilePanel
            title="로컬"
            files={local.files}
            currentPath={local.currentPath}
            sortColumn={local.sortColumn}
            sortAscending={local.sortAscending}
            drives={local.drives}
            selectedDrive={local.currentPath.substring(0, 3)}
            selectedItems={localSelection}
            contextMenuItems={localContextMenuItems}
            onDriveChange={local.changeDrive}
            onPathChange={(p) => local.loadDirectory(p)}
            onNavigateUp={() => local.navigateUp()}
            onItemDoubleClick={handleLocalDoubleClick}
            onSort={local.sortBy}
            onRefresh={local.refresh}
            onCreateDir={handleLocalCreateDir}
            onDelete={handleLocalDelete}
            onSelectionChange={setLocalSelection}
            onContextAction={handleLocalContextAction}
          />
        </div>

        {/* Resizable splitter */}
        <div
          className="w-1 bg-border hover:bg-primary cursor-col-resize shrink-0 transition-colors active:bg-primary"
          onMouseDown={splitPane.onMouseDown}
        />

        {/* Remote panel */}
        <div className="flex flex-col min-w-0 overflow-hidden" style={{ width: (100 - splitPane.leftPercent) + '%' }}>
          <FilePanel
            title="리모트"
            files={remote.files}
            currentPath={remote.currentPath}
            sortColumn={remote.sortColumn}
            sortAscending={remote.sortAscending}
            disabled={!isConnected}
            showPermissions
            selectedItems={remoteSelection}
            contextMenuItems={remoteContextMenuItems}
            onNavigateUp={() => remote.navigateUp()}
            onItemDoubleClick={handleRemoteDoubleClick}
            onSort={remote.sortBy}
            onRefresh={remote.refresh}
            onCreateDir={handleRemoteCreateDir}
            onDelete={handleRemoteDelete}
            onSelectionChange={setRemoteSelection}
            onContextAction={handleRemoteContextAction}
          />
        </div>
      </div>

      {/* Transfer Queue */}
      <div className="h-36 shrink-0">
        <TransferQueue
          transfers={transfer.transfers}
          onClearCompleted={transfer.clearCompleted}
        />
      </div>

      {/* Banner ad - 50px */}
      <BannerAd />

      {/* Status bar */}
      <div className="h-6 bg-statusbar flex items-center text-white text-xs shrink-0">
        <span className="bg-primary-hover px-2 py-0.5 truncate">{statusText}</span>
        <div className="flex-1" />
        {connectionInfo && (
          <span className="text-white/80 mr-3">{connectionInfo}</span>
        )}
        <button
          onClick={() => { setSyncBrowsing(!syncBrowsing); setStatusText(syncBrowsing ? '탐색 동기화 비활성화' : '탐색 동기화 활성화'); }}
          className={`px-2.5 py-0.5 text-xs ${syncBrowsing ? 'bg-white/30' : 'bg-white/10 hover:bg-white/20'}`}
        >
          탐색 동기화 : {syncBrowsing ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Dialogs */}
      <ConnectionManager
        isOpen={showConnManager}
        onClose={() => setShowConnManager(false)}
        onConnect={connectWithProfile}
      />
      <InputDialog
        title={inputDialog.title}
        message={inputDialog.message}
        defaultValue={inputDialog.defaultValue}
        isOpen={inputDialog.isOpen}
        onConfirm={handleInputConfirm}
        onCancel={() => setInputDialog(prev => ({ ...prev, isOpen: false }))}
      />
      <BookmarkEditDialog
        bookmark={editingBookmark}
        isOpen={editingBookmark !== null}
        mode={bookmarkDialogMode}
        onSave={handleSaveBookmark}
        onCancel={() => setEditingBookmark(null)}
      />

      {/* Click outside menus */}
      {anyMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={closeAllMenus} />
      )}
    </div>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 0) return '?';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

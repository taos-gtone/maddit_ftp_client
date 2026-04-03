import { useState, useCallback, useRef, useEffect } from 'react';
import type { FileItem, SortColumn } from '../types/index';

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(isoStr: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export interface ContextMenuAction {
  label: string;
  action: string;
  disabled?: boolean;
  separator?: boolean;
}

interface Props {
  title: string;
  files: FileItem[];
  currentPath: string;
  sortColumn: SortColumn;
  sortAscending: boolean;
  disabled?: boolean;
  showPermissions?: boolean;
  drives?: string[];
  selectedDrive?: string;
  selectedItems: FileItem[];
  contextMenuItems?: ContextMenuAction[];
  onDriveChange?: (drive: string) => void;
  onPathChange?: (path: string) => void;
  onNavigateUp: () => void;
  onItemDoubleClick: (item: FileItem) => void;
  onSort: (column: SortColumn) => void;
  onRefresh: () => void;
  onCreateDir: () => void;
  onDelete: (item: FileItem) => void;
  onSelectionChange: (items: FileItem[]) => void;
  onContextAction?: (action: string, items: FileItem[]) => void;
}

export default function FilePanel({
  title, files, currentPath, sortColumn, sortAscending,
  disabled, showPermissions, drives, selectedDrive,
  selectedItems, contextMenuItems,
  onDriveChange, onPathChange, onNavigateUp,
  onItemDoubleClick, onSort, onRefresh, onCreateDir, onDelete,
  onSelectionChange, onContextAction,
}: Props) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const lastClickedIndexRef = useRef<number>(-1);
  const panelRef = useRef<HTMLDivElement>(null);

  // 패널 외부 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    function handleClick() { setContextMenu(null); }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const sortIndicator = useCallback((col: SortColumn) => {
    if (sortColumn !== col) return '';
    return sortAscending ? ' \u25B2' : ' \u25BC';
  }, [sortColumn, sortAscending]);

  // 선택 가능한 파일 목록 (.. 제외)
  const selectableFiles = files.filter(f => !f.isParentDirectory);

  function getFileIndex(item: FileItem): number {
    return selectableFiles.findIndex(f => f.fullPath === item.fullPath);
  }

  function handleRowClick(item: FileItem, e: React.MouseEvent) {
    setContextMenu(null);

    if (item.isParentDirectory) {
      onSelectionChange([item]);
      lastClickedIndexRef.current = -1;
      return;
    }

    const idx = getFileIndex(item);

    if (e.shiftKey && lastClickedIndexRef.current >= 0) {
      // Shift+클릭: 범위 선택
      const start = Math.min(lastClickedIndexRef.current, idx);
      const end = Math.max(lastClickedIndexRef.current, idx);
      const rangeItems = selectableFiles.slice(start, end + 1);
      if (e.ctrlKey) {
        // Ctrl+Shift: 기존 선택에 범위 추가
        const merged = [...selectedItems];
        for (const ri of rangeItems) {
          if (!merged.some(s => s.fullPath === ri.fullPath)) merged.push(ri);
        }
        onSelectionChange(merged);
      } else {
        onSelectionChange(rangeItems);
      }
    } else if (e.ctrlKey) {
      // Ctrl+클릭: 토글 선택
      const isSelected = selectedItems.some(s => s.fullPath === item.fullPath);
      if (isSelected) {
        onSelectionChange(selectedItems.filter(s => s.fullPath !== item.fullPath));
      } else {
        onSelectionChange([...selectedItems, item]);
      }
      lastClickedIndexRef.current = idx;
    } else {
      // 일반 클릭: 단일 선택
      onSelectionChange([item]);
      lastClickedIndexRef.current = idx;
    }
  }

  function handleRowContextMenu(item: FileItem, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (item.isParentDirectory) return;

    // 우클릭한 항목이 현재 선택에 없으면, 해당 항목만 선택
    if (!selectedItems.some(s => s.fullPath === item.fullPath)) {
      onSelectionChange([item]);
      lastClickedIndexRef.current = getFileIndex(item);
    }

    // 패널 기준 좌표 계산
    const rect = panelRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const y = e.clientY - (rect?.top ?? 0);
    setContextMenu({ x, y });
  }

  function handleContextAction(action: string) {
    setContextMenu(null);
    const items = selectedItems.filter(s => !s.isParentDirectory);
    onContextAction?.(action, items);
  }

  function handleDeleteClick() {
    const item = selectedItems.find(s => !s.isParentDirectory);
    if (item) onDelete(item);
  }

  // Ctrl+A 전체 선택
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      onSelectionChange(selectableFiles);
    }
  }

  return (
    <div
      ref={panelRef}
      className={`flex flex-col h-full relative ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Panel title */}
      <div className="h-6 bg-primary text-white flex items-center px-2 shrink-0">
        <span className="text-xs font-bold">{title}</span>
      </div>

      {/* Path bar */}
      <div className="h-7 bg-white border-b border-border flex items-center px-1.5 gap-1 shrink-0">
        {drives && onDriveChange && (
          <select
            value={selectedDrive}
            onChange={e => onDriveChange(e.target.value)}
            className="h-5 text-xs border border-border rounded-sm bg-white px-0.5 w-14 shrink-0"
          >
            {drives.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <input
          type="text"
          value={currentPath}
          onChange={e => onPathChange?.(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && onPathChange) onPathChange(currentPath); }}
          className="flex-1 h-5 text-xs border border-border rounded-sm px-1.5 bg-white min-w-0"
          readOnly={!onPathChange}
        />
        <button onClick={onRefresh} className="w-5 h-5 flex items-center justify-center text-xs text-text-sub hover:bg-hover rounded-sm shrink-0" title="새로고침">
          &#8635;
        </button>
        <button onClick={onNavigateUp} className="w-5 h-5 flex items-center justify-center text-xs text-text-sub hover:bg-hover rounded-sm shrink-0" title="상위 폴더">
          &#8593;
        </button>
      </div>

      {/* Action bar */}
      <div className="h-6 bg-white border-b border-border flex items-center px-2 gap-3 shrink-0">
        <button onClick={onCreateDir} className="text-xs text-primary hover:underline font-semibold">
          새 폴더
        </button>
        <button
          onClick={handleDeleteClick}
          disabled={selectedItems.filter(s => !s.isParentDirectory).length === 0}
          className="text-xs text-primary hover:underline font-semibold disabled:text-text-muted disabled:no-underline"
        >
          삭제
        </button>
      </div>

      {/* Column Headers */}
      <div className="h-6 bg-surface border-b border-border flex items-center text-xs font-semibold text-text shrink-0 select-none">
        <div className="flex-1 px-2 cursor-pointer hover:bg-hover" onClick={() => onSort('name')}>
          이름{sortIndicator('name')}
        </div>
        <div className="w-24 px-2 text-right cursor-pointer hover:bg-hover" onClick={() => onSort('size')}>
          크기{sortIndicator('size')}
        </div>
        <div className="w-36 px-2 cursor-pointer hover:bg-hover" onClick={() => onSort('date')}>
          수정일{sortIndicator('date')}
        </div>
        {showPermissions && <div className="w-20 px-2">권한</div>}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {files.map((item) => {
          const isSelected = selectedItems.some(s => s.fullPath === item.fullPath);
          return (
            <div
              key={item.fullPath}
              className={`h-[22px] flex items-center text-xs cursor-default
                ${isSelected ? 'bg-selection' : 'hover:bg-hover'}`}
              onClick={e => handleRowClick(item, e)}
              onDoubleClick={() => onItemDoubleClick(item)}
              onContextMenu={e => handleRowContextMenu(item, e)}
            >
              <div className="flex items-center flex-1 px-2 min-w-0">
                <span className="w-5 text-center shrink-0 text-sm leading-none">
                  {item.isParentDirectory ? '' : item.isDirectory ? '\uD83D\uDCC1' : '\uD83D\uDCC4'}
                </span>
                <span className="truncate">{item.name}</span>
              </div>
              <div className="w-24 px-2 text-right text-text-sub shrink-0">
                {item.isDirectory ? '' : formatSize(item.size)}
              </div>
              <div className="w-36 px-2 text-text-sub shrink-0">
                {item.isParentDirectory ? '' : formatDate(item.lastModified)}
              </div>
              {showPermissions && (
                <div className="w-20 px-2 text-text-muted font-mono text-[10px] shrink-0">
                  {item.permissions || ''}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context menu */}
      {contextMenu && contextMenuItems && (
        <div
          className="absolute bg-white border border-border shadow-lg z-50 min-w-[140px] py-0.5 context-menu-enter"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenuItems.map((mi, i) =>
            mi.separator ? (
              <div key={i} className="h-px bg-border my-0.5" />
            ) : (
              <button
                key={i}
                onClick={() => handleContextAction(mi.action)}
                disabled={mi.disabled}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-selection disabled:text-text-muted disabled:hover:bg-white"
              >
                {mi.label}
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef } from 'react';
import type { Bookmark } from '../types/index';

interface Props {
  bookmark: Bookmark | null;
  isOpen: boolean;
  mode?: 'add' | 'edit';
  onSave: (bookmark: Bookmark) => void;
  onCancel: () => void;
}

export default function BookmarkEditDialog({ bookmark, isOpen, mode = 'edit', onSave, onCancel }: Props) {
  const [name, setName] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [remotePath, setRemotePath] = useState('');
  const [syncBrowsing, setSyncBrowsing] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && bookmark) {
      setName(bookmark.name);
      setLocalPath(bookmark.localPath);
      setRemotePath(bookmark.remotePath);
      setSyncBrowsing(bookmark.syncBrowsing ?? false);
      setTimeout(() => nameRef.current?.focus(), 50);
    }
  }, [isOpen, bookmark]);

  if (!isOpen || !bookmark) return null;

  function handleSave() {
    if (!name.trim()) return;
    onSave({
      ...bookmark!,
      name: name.trim(),
      localPath: localPath.trim(),
      remotePath: remotePath.trim(),
      syncBrowsing,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onCancel();
  }

  async function handleBrowseLocal() {
    const dir = await window.electronAPI.openDirectoryDialog();
    if (dir) setLocalPath(dir);
  }

  const title = mode === 'add' ? '북마크 추가' : '북마크 수정';
  const saveLabel = mode === 'add' ? '추가' : '저장';

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-md shadow-lg border border-border w-[420px] p-4" onKeyDown={handleKeyDown}>
        <h3 className="text-sm font-bold text-text mb-3">{title}</h3>

        {/* 이름 */}
        <label className="block text-xs text-text-sub mb-1">북마크 이름</label>
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full h-7 px-2 border border-border rounded-sm text-xs mb-3"
          placeholder="북마크 이름 (영문, 한글, _, - 사용 가능)"
        />

        {/* 로컬 경로 */}
        <label className="block text-xs text-text-sub mb-1">로컬 디렉토리</label>
        <div className="flex gap-1 mb-3">
          <input
            type="text"
            value={localPath}
            onChange={e => setLocalPath(e.target.value)}
            className="flex-1 h-7 px-2 border border-border rounded-sm text-xs"
            placeholder="C:\Users\..."
          />
          <button
            onClick={handleBrowseLocal}
            className="px-2 h-7 bg-surface border border-border rounded-sm text-xs hover:bg-hover shrink-0"
          >
            찾아보기
          </button>
        </div>

        {/* 리모트 경로 */}
        <label className="block text-xs text-text-sub mb-1">리모트 디렉토리</label>
        <input
          type="text"
          value={remotePath}
          onChange={e => setRemotePath(e.target.value)}
          className="w-full h-7 px-2 border border-border rounded-sm text-xs mb-3"
          placeholder="/home/user/..."
        />

        {/* 탐색 동기화 */}
        <label className="flex items-center gap-2 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={syncBrowsing}
            onChange={e => setSyncBrowsing(e.target.checked)}
            className="accent-primary"
          />
          <span className="text-xs text-text">이동 시 탐색 동기화 활성화</span>
        </label>

        {/* 버튼 */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-surface border border-border rounded-sm text-xs hover:bg-hover"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1 bg-primary text-white rounded-sm text-xs hover:bg-primary-hover disabled:opacity-50"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

import type { TransferItem } from '../types/index';

function formatSize(bytes: number): string {
  if (bytes <= 0) return '0';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

const STATUS_TEXT: Record<string, string> = {
  queued: '대기',
  inProgress: '전송 중',
  completed: '완료',
  failed: '실패',
};

interface Props {
  transfers: TransferItem[];
  onClearCompleted: () => void;
}

export default function TransferQueue({ transfers, onClearCompleted }: Props) {
  return (
    <div className="flex flex-col h-full border-t border-border">
      {/* Header */}
      <div className="h-6 bg-surface border-b border-border flex items-center px-2 shrink-0">
        <span className="text-xs font-bold text-text">전송 큐</span>
        <div className="flex-1" />
        <button
          onClick={onClearCompleted}
          className="text-xs text-primary hover:underline font-semibold mr-3"
        >
          완료 항목 삭제
        </button>
        <span className="text-xs text-primary hover:underline font-semibold cursor-pointer">
          전체 취소
        </span>
      </div>

      {/* Column Headers */}
      <div className="h-6 bg-surface border-b border-border flex items-center text-xs font-semibold text-text shrink-0">
        <div className="w-10 text-center px-1">방향</div>
        <div className="flex-[2] px-2">파일명</div>
        <div className="w-16 px-1 text-center">상태</div>
        <div className="w-36 px-2">진행률</div>
        <div className="flex-[2] px-2">리모트 경로</div>
      </div>

      {/* Transfer list */}
      <div className="flex-1 overflow-y-auto bg-white">
        {transfers.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-text-muted">
            전송 항목 없음
          </div>
        )}
        {transfers.map(item => (
          <div
            key={item.id}
            className="h-[22px] flex items-center text-xs border-b border-border-light"
          >
            <div className="w-10 text-center text-sm">
              {item.direction === 'upload' ? '\u2191' : '\u2193'}
            </div>
            <div className="flex-[2] px-2 truncate" title={item.fileName}>
              {item.fileName}
            </div>
            <div className={`w-16 px-1 text-center ${
              item.status === 'completed' ? 'text-success' :
              item.status === 'failed' ? 'text-error' :
              item.status === 'inProgress' ? 'text-primary' : 'text-text-sub'
            }`}>
              {STATUS_TEXT[item.status] || item.status}
            </div>
            <div className="w-36 px-2">
              <div className="progress-bar h-3.5">
                <div
                  className="progress-bar-fill"
                  style={{ width: (item.totalBytes > 0 ? (item.bytesTransferred / item.totalBytes * 100) : 0) + '%' }}
                />
              </div>
            </div>
            <div className="flex-[2] px-2 truncate text-text-sub" title={item.remotePath}>
              {item.remotePath}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

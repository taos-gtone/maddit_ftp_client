export default function TitleBar() {
  return (
    <div
      className="h-8 bg-surface border-b border-border flex items-center px-3 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 flex-1">
        <span className="text-xs"><span className="text-red-500 font-bold">Maddit</span> <span className="text-text font-bold">FTP Client</span> <span className="text-text-sub font-normal">v1.0.0</span></span>
      </div>

      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => window.electronAPI.minimizeWindow()}
          className="w-11 h-8 flex items-center justify-center hover:bg-hover transition-colors text-text-sub"
          title="최소화"
        >
          <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
        </button>
        <button
          onClick={() => window.electronAPI.maximizeWindow()}
          className="w-11 h-8 flex items-center justify-center hover:bg-hover transition-colors text-text-sub"
          title="최대화"
        >
          <svg width="9" height="9" viewBox="0 0 9 9" fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="0.5" y="0.5" width="8" height="8"/>
          </svg>
        </button>
        <button
          onClick={() => window.electronAPI.closeWindow()}
          className="w-11 h-8 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors text-text-sub"
          title="닫기"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.2">
            <line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

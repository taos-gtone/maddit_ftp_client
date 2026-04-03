import { useState, useCallback, useRef, useEffect } from 'react';

export function useSplitPane(initialRatio = 0.5) {
  const [leftPercent, setLeftPercent] = useState(initialRatio * 100);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const totalWidth = rect.width;
      // 4px splitter 폭 보정
      let percent = ((x - 2) / (totalWidth - 4)) * 100;
      // 최소 20%, 최대 80%
      percent = Math.max(20, Math.min(80, percent));
      setLeftPercent(percent);
    }

    function onMouseUp() {
      if (draggingRef.current) {
        draggingRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return { leftPercent, containerRef, onMouseDown };
}

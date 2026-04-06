import { useState, useEffect, useRef, useCallback } from 'react';

interface BannerData {
  imageUrl: string;
  clickUrl: string;
  mediaType?: string;
  mediaUrl?: string;
  sortOrder?: number;
}

const ROTATE_INTERVAL = 5000; // 5초마다 롤링

export default function BannerAd() {
  const [banners, setBanners] = useState<BannerData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fade, setFade] = useState(true);
  const fetched = useRef(false);

  // 배너 목록 불러오기
  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    window.electronAPI?.fetchBanners().then((data: unknown) => {
      const d = data as Record<string, unknown>;
      const list = Array.isArray(d) ? d : (d?.data ?? d?.list ?? d?.banners) as unknown[];
      if (!Array.isArray(list) || list.length === 0) return;

      const sorted = list
        .filter((it: Record<string, unknown>) => it.imageUrl || it.mediaUrl)
        .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
          ((a.sortOrder as number) ?? 0) - ((b.sortOrder as number) ?? 0)
        )
        .map((it: Record<string, unknown>) => ({
          imageUrl: (it.imageUrl as string) || '',
          clickUrl: (it.clickUrl as string) || '',
          mediaType: (it.mediaType as string) || 'IMAGE',
          mediaUrl: (it.mediaUrl as string) || '',
          sortOrder: (it.sortOrder as number) ?? 0,
        }));

      setBanners(sorted);
    }).catch(() => {});
  }, []);

  // 롤링 타이머
  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % banners.length);
        setFade(true);
      }, 300);
    }, ROTATE_INTERVAL);
    return () => clearInterval(timer);
  }, [banners.length]);

  const handleClick = useCallback(() => {
    const banner = banners[currentIndex];
    if (banner?.clickUrl) window.electronAPI?.openExternal(banner.clickUrl);
  }, [banners, currentIndex]);

  const banner = banners[currentIndex];

  return (
    <div className="h-[50px] shrink-0 bg-surface border-t border-border flex items-center justify-center overflow-hidden">
      {banner ? (
        <div
          className="flex items-center justify-center w-full h-full transition-opacity duration-300"
          style={{ opacity: fade ? 1 : 0 }}
        >
          {banner.mediaType === 'VIDEO' && banner.mediaUrl ? (
            <video
              key={currentIndex}
              src={banner.mediaUrl}
              className="cursor-pointer max-h-full max-w-full object-contain"
              muted autoPlay loop playsInline
              onClick={handleClick}
            />
          ) : (
            <img
              key={currentIndex}
              src={banner.imageUrl}
              alt=""
              className="cursor-pointer max-h-full max-w-full object-contain"
              onClick={handleClick}
            />
          )}
        </div>
      ) : (
        <div className="text-text-muted text-xs text-center">
          <p className="font-medium">AD SPACE</p>
          <p className="mt-0.5">728 x 90</p>
        </div>
      )}
    </div>
  );
}

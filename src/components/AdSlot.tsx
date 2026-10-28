'use client';

import { useEffect, useRef, useState } from 'react';
import { callApi } from '@/lib/api';
import type { ServedAd } from '@/lib/types';
import { AdCard } from './AdCard';
import { useApp } from './AppProvider';

/**
 * 広告の枠。画面に入ったときに初めて広告を読み込む（見られていない広告を「表示」と数えないため）。
 * 有料プランのスペース、お試しモードでは何も表示しない。
 * 広告であることが分かるよう、必ず「PR」と表示する（景品表示法のステマ規制への対応）。
 */
export function AdSlot({ slot }: { slot: 'home' }) {
  const { workspace, store } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const [ad, setAd] = useState<ServedAd | null>(null);
  const enabled = store?.mode === 'firebase' && !!workspace && (workspace.plan ?? 'free') === 'free';
  const workspaceId = workspace?.id ?? '';

  useEffect(() => {
    setAd(null);
    const el = ref.current;
    if (!enabled || !el) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        callApi<{ ad: ServedAd | null }>(`/api/ads/serve?wid=${encodeURIComponent(workspaceId)}&slot=${slot}`, {
          method: 'GET',
        })
          .then((r) => !cancelled && setAd(r.ad))
          .catch(() => {}); // 広告が出なくてもアプリの利用には影響させない
      },
      { rootMargin: '0px 0px 100px 0px' },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [enabled, workspaceId, slot]);

  if (!enabled) return null;

  return (
    <div ref={ref} className="ad-slot" aria-live="polite">
      {ad && <AdCard title={ad.title} description={ad.description} imageUrl={ad.imageUrl} href={ad.clickUrl} />}
    </div>
  );
}

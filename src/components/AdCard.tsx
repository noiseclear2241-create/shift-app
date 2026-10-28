'use client';

import { useState } from 'react';
import { bannerShape } from '@/lib/ads';

/**
 * 広告1件の見た目（ホームの広告枠と、管理画面の見本で共通）。
 * 横長のバナーは幅いっぱいに、それ以外は左に小さく表示する。必ず「PR」を付ける。
 */
export function AdCard({
  title,
  description,
  imageUrl,
  href,
}: {
  title: string;
  description: string;
  imageUrl: string;
  /** 押したときの移動先。管理画面の見本では空（押せない） */
  href?: string;
}) {
  const [shape, setShape] = useState<ReturnType<typeof bannerShape>>('unknown');
  const showImage = /^https:\/\//.test(imageUrl);

  const body = (
    <>
      <span className="ad-label">PR</span>
      {showImage && (
        // 広告会社の画像はサイズがまちまちなので、読み込んでから形に合わせて並べ方を変える
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading={href ? 'lazy' : 'eager'}
          referrerPolicy="no-referrer"
          className="ad-image"
          onLoad={(e) => setShape(bannerShape(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))}
        />
      )}
      <span className="ad-body">
        <span className="ad-title">{title}</span>
        {description && <span className="small muted">{description}</span>}
      </span>
    </>
  );

  const className = `ad-card ${shape === 'wide' ? 'is-wide' : ''}`;
  return href ? (
    <a href={href} target="_blank" rel="sponsored noopener noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

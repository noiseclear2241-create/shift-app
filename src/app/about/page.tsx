import type { Metadata } from 'next';
import Link from 'next/link';
import { SITE } from '@/lib/site';

// ログインしなくても見られる紹介ページ（初めての人・広告会社の審査向け）

export const metadata: Metadata = {
  title: `${SITE.name}｜催事・イベントスタッフのシフト管理アプリ`,
  description:
    '催事・イベントで働くスタッフ向けのシフト管理アプリ。次の出勤予定、シフト希望の提出、タスク・期限の通知をスマホで確認できます。チームでの利用にも対応。',
};

const FEATURES = [
  { title: '次の出勤がすぐ分かる', body: '開いた瞬間に、次の出勤の日付・会場・勤務時間・持ち物を大きく表示します。今日の予定とタスクもまとめて確認できます。' },
  { title: 'シフト希望をスマホで提出', body: '「12月分」などの受付に、出られる日を ○△× で提出。管理者は日ごとの集計と未提出の人をすぐに確認できます。' },
  { title: '毎朝の通知', body: 'シフト提出期限の3日前・前日・当日や、明日の出勤をスマホに通知します。確定した出勤だけを知らせるので、迷いません。' },
  { title: '会場ごとに色分けしたカレンダー', body: '複数の催事会場を色で区別。確定・未確定も一目で分かります。' },
  { title: 'チームで共有', body: '招待リンクでメンバーを招き、オーナー・管理者・スタッフの役割で権限を分けられます。アプリを使わない人も名前だけで登録できます。' },
  { title: '準備タスクと連絡事項', body: '出勤ごとの準備タスク、持ち物、集合場所などの連絡事項を一緒に管理できます。' },
];

const FAQ = [
  { q: 'アプリのインストールは必要ですか？', a: 'いいえ。スマホやパソコンのブラウザで使えます。ホーム画面に追加すると、アプリのようにすぐ開けます。' },
  { q: '料金はかかりますか？', a: '現在は無料でお使いいただけます。無料でご利用の場合、ホーム画面の下に広告が1つ表示されます（「PR」と表示）。' },
  { q: '通知はどの端末で受け取れますか？', a: 'Android は Chrome で、iPhone はホーム画面に追加したアプリから受け取れます（iOS 16.4 以降）。' },
  { q: 'チームのほかの人に、自分の情報はどこまで見えますか？', a: '同じチームのメンバーには、名前と、チームに登録された出勤予定が表示されます。提出したシフト希望は、本人とチームの管理者だけが見られます。' },
];

export default function AboutPage() {
  return (
    <div className="lp">
      <header className="lp-header">
        <span className="brand">{SITE.name}</span>
        <Link href="/login" className="btn btn-outline btn-sm">
          ログイン
        </Link>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-text">
          <h1>
            {/* 「、」のあとで改行して、言葉の途中で折り返さないようにする */}
            {SITE.catchCopy.split('、').map((part, i, all) => (
              <span key={i} className="nowrap-line">
                {part}
                {i < all.length - 1 && '、'}
              </span>
            ))}
          </h1>
          <p>
            {SITE.name}は、百貨店の催事や各地のイベントで働くスタッフと、催事を運営するチームのためのシフト管理アプリです。
            出勤予定・シフト希望・準備タスクを、ひとつの画面で確認できます。
          </p>
          <div className="lp-cta">
            <Link href="/login" className="btn btn-primary">
              無料ではじめる
            </Link>
            <span className="small muted">メールアドレスまたは Google アカウントで登録できます</span>
          </div>
        </div>

        {/* 画面イメージ（実際のホーム画面の「次の出勤」と同じ見た目） */}
        <figure className="lp-shot" aria-label="画面イメージ">
          <div className="card next-card" style={{ borderTopColor: '#db2777' }}>
            <div className="next-head">
              <span className="next-label">次の出勤</span>
              <span className="countdown">あと2日</span>
            </div>
            <div className="next-date">11月14日(土)</div>
            <div className="next-venue">〇〇百貨店 本店</div>
            <dl className="next-facts">
              <div>
                <dt>勤務時間</dt>
                <dd>10:00〜19:00</dd>
              </div>
              <div>
                <dt>催事</dt>
                <dd>北海道物産展</dd>
              </div>
              <div>
                <dt>持ち物</dt>
                <dd>制服・名札</dd>
              </div>
            </dl>
          </div>
          <figcaption className="small muted">画面イメージ（表示内容は例です）</figcaption>
        </figure>
      </section>

      <section className="lp-section">
        <h2>こんな方に</h2>
        <div className="lp-grid two">
          <div className="card">
            <h3>催事・イベントで働くスタッフ</h3>
            <p>会場や時間が毎回変わる出勤予定を、スマホで迷わず確認したい方。シフト希望の提出や、持ち物の準備を忘れたくない方。</p>
          </div>
          <div className="card">
            <h3>催事を運営する会社・チーム</h3>
            <p>複数の会場・スタッフのシフトをまとめて管理したい方。シフト希望の回収や、提出期限の連絡を楽にしたい方。</p>
          </div>
        </div>
      </section>

      <section className="lp-section">
        <h2>主な機能</h2>
        <div className="lp-grid three">
          {FEATURES.map((f) => (
            <div key={f.title} className="card">
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>料金と広告について</h2>
        <div className="card">
          <p>
            現在は<b>無料</b>でお使いいただけます。無料でご利用の場合、ホーム画面の下のほうに広告が1つ表示されます。広告には必ず「PR」と表示しています。
          </p>
          <p style={{ marginBottom: 0 }}>
            広告をクリックしても、お名前・出勤予定などの情報が広告主に送られることはありません。今後、広告が表示されない有料プランを用意する予定です。
          </p>
        </div>
      </section>

      <section className="lp-section">
        <h2>よくある質問</h2>
        <div className="stack">
          {FAQ.map((f) => (
            <details key={f.q} className="card lp-faq">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <h2>運営者情報</h2>
        <dl className="card detail-list">
          <div>
            <dt>サービス名</dt>
            <dd>{SITE.name}</dd>
          </div>
          <div>
            <dt>運営者</dt>
            <dd>{SITE.operator || '準備中'}</dd>
          </div>
          <div>
            <dt>お問い合わせ</dt>
            <dd>{SITE.contactEmail ? <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a> : '準備中'}</dd>
          </div>
        </dl>
      </section>

      <section className="lp-section lp-final">
        <h2>まずは無料で使ってみる</h2>
        <Link href="/login" className="btn btn-primary">
          無料ではじめる
        </Link>
      </section>

      <footer className="lp-footer small muted">© {new Date().getFullYear()} {SITE.name}</footer>
    </div>
  );
}

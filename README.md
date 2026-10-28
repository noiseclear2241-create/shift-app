# シフト手帳

催事・イベント業務向けのシフト管理アプリです。ホーム画面で「次の出勤」「今日の予定」「今後の出勤」「期限が近い項目」をまとめて確認できます。

- 使っている技術：Next.js 14（画面）＋ Firebase（ログインとデータ保存）
- Firebase を設定していない状態では「お試しモード」で動きます（データはそのブラウザの中だけに保存）

## できること

| 画面 | 内容 |
| --- | --- |
| ホーム `/` | 今日の日付、期限が近い・過ぎている項目、次の出勤（会場・日付・勤務時間・あと何日）、今日の予定（時刻順・完了状態の切り替え）、今後の出勤一覧 |
| カレンダー `/calendar` | 月表示。会場ごとに色分け、確定は塗りつぶし・未確定は点線 |
| 出勤 `/shifts` | 今後／終了／キャンセルの一覧、登録・編集・状態変更、準備タスクの追加 |
| タスク `/tasks` | タスク（未完了→進行中→完了）と提出期限（未提出／提出済み）の管理 |
| 催事 `/events` | 会場名・催事名・施設・開催期間・持ち物・連絡事項の登録 |
| 設定 `/settings` | ホーム画面への追加方法、通知の種類ごとのオン・オフ、翌朝に届く通知の見本、ログアウト |

### 「次の出勤」のルール
- 状態が **確定** で、まだ終わっていない出勤のうち、いちばん近いものを表示します
- **未確定** と **キャンセル** は「次の出勤」には出しません（未確定は一覧に「未確定」と表示）
- 今日の出勤は「本日の出勤」、勤務時間中は「本日の出勤（勤務中）」と表示します
- 終了時刻が開始より前の場合は、翌日に終わる夜勤として扱います

## パソコンで動かす

```bash
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。

```bash
npm test
```

で「次の出勤」などの計算ロジックのテストを実行できます。

## Firebase につなぐ（本番で使うとき）

1. [Firebaseコンソール](https://console.firebase.google.com/) でプロジェクトを作成（または既存のものを使用）
2. **Authentication** →「ログイン方法」で「メール/パスワード」と「Google」を有効にする
3. **Firestore Database** を作成する
4. **Firestore → ルール** に `firestore.rules` の中身を貼り付けて「公開」する
   （これを忘れると、他人のデータが見えたり、逆に自分のデータも読めなくなったりします）
5. 「プロジェクトの設定」→「マイアプリ」でウェブアプリを追加し、表示された値を `.env.example` を参考に `.env.local` に書く
6. `npm run dev` で起動し、ログイン画面が出れば接続できています

### データの保存場所（Firestore）

```
workspaces/{ユーザーID}            … 作業スペース（ownerId, members, plan など）
  ├ events/{id}     催事：name, venue, facility, startDate, endDate, belongings, notes
  ├ shifts/{id}     出勤：eventId, date, startTime, endTime, staff, role, status, notes
  ├ tasks/{id}      タスク：title, date, time, status, shiftId（準備タスクの紐づけ）, notes
  └ deadlines/{id}  提出期限：title, date, time, done, notes
```

```
users/{ユーザーID}                 … 人ごとの設定：notifications（通知の種類ごとのオン・オフ）, timezone, workspaceId
  └ devices/{id}    プッシュ通知を受け取る端末（段階2で使用）
```

今は1人につき1つの作業スペースです。将来チーム・企業で使う場合は、`members` に他のユーザーを加える仕組み（招待・権限）を追加します。

## Vercel に公開する

1. このフォルダを GitHub にアップロードする
2. Vercel で「Add New → Project」から、そのリポジトリを選ぶ
3. 「Environment Variables」に `.env.local` と同じ6つの値を登録する
4. Deploy
5. Firebase の Authentication →「設定」→「承認済みドメイン」に Vercel のドメイン（例：`xxxx.vercel.app`）を追加する

## アイコン
`public/icons/` のアイコンは `node scripts/make-icons.mjs` で作り直せます。

## プッシュ通知
- 設定画面の「この端末で通知を受け取る」で端末を登録（iPhone はホーム画面に追加したアプリから）
- 毎朝の自動送信：`vercel.json` の定時実行が `/api/cron/morning` を毎日 22:00（世界標準時）＝日本時間 7:00 に呼ぶ
  - Vercel の無料プランでは、実行時刻が指定した1時間の中で前後する
- 通知の中身：`src/lib/notifications.ts`（提出期限3日前・前日・当日／明日の確定出勤／今日の予定）
- 同じ通知は1日1回だけ：送信記録 `workspaces/{ID}/notificationLog` で管理
- 必要な環境変数：`NEXT_PUBLIC_FIREBASE_VAPID_KEY`（公開値）、`FIREBASE_SERVICE_ACCOUNT`・`CRON_SECRET`（秘密情報）

## 今後の予定（まだ無い機能）
- チーム・企業でのデータ共有、招待、権限管理
- 広告・アフィリエイトの管理画面、有料プラン・決済

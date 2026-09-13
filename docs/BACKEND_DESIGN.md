# バックエンド設計ドキュメント

認証・ユーザー管理・マルチテナンシーをどう設計するかをまとめる。実装は Firestore(NoSQL)で行うが、同じ要件を SQL(リレーショナルDB)で設計した場合の比較もあわせて記載する。

---

## 1. Firebase Auth と Firestore、それぞれに何を持たせるか

大原則: **Auth は「本人確認」だけを担当し、組織・ロールなどのビジネスデータは一切持たない。ビジネスデータは全て Firestore が正(source of truth)。**

| データ | 置き場所 | 理由 |
|---|---|---|
| メールアドレス / パスワード(ハッシュ) | Firebase Auth | 認証情報そのものなのでAuthの責務。自前で管理しない(後述のSQL設計でも同様の考え方を採用) |
| uid(ユーザーの一意識別子) | Firebase Auth が発行 | 全データはこの uid を外部キーとして紐付ける |
| emailVerified、最終ログイン日時など | Firebase Auth | Authが標準で管理する認証まわりのメタ情報 |
| **Custom Claims**: `{ orgId, role }` | Firebase Auth(ただしAdmin SDK経由でのみ書き込み可) | セキュリティルールをDBアクセスなしで高速評価するための**キャッシュ**。正データではない(下記参照) |
| 組織情報(組織名、作成日) | Firestore `organizations/{orgId}` | ビジネスデータ |
| 所属・ロールの実データ | Firestore `organizations/{orgId}/members/{uid}` | **ここが role の正データ**。Custom Claims はこのドキュメントの内容を、パフォーマンスのためにトークンへコピーしたものに過ぎない |
| 招待情報 | Firestore `organizations/{orgId}/invites/{inviteId}` | ビジネスデータ |
| タスク | Firestore `organizations/{orgId}/tasks/{taskId}` | ビジネスデータ |
| uid → orgId の逆引き | Firestore `users/{uid}` (トップレベル、最小限のポインタドキュメント) | ログイン直後に「このユーザーはどの組織に属するか」を1回のreadで引くために必要 |

### なぜ Custom Claims を「キャッシュ」と呼ぶか

`organizations/{orgId}/members/{uid}` の `role` フィールドが更新された瞬間、Custom Claims は自動更新されない。役職変更のAPIを実行したサーバー側処理が、Firestoreの更新と**同時に** Admin SDK で Custom Claims を書き換える必要がある。さらにクライアント側は `getIdToken(true)` で明示的にトークンを更新しない限り、古い role のまま動作する。

つまり「本当に権限があるかどうか」を最終的に保証しているのは Firestore 側のメンバードキュメントであり、Custom Claims は「セキュリティルールを速くするための最適化」でしかない、という理解が重要。

---

## 2. Firestore コレクション構成

```
organizations/{orgId}
  - name: string
  - createdAt: timestamp
  - createdBy: uid

organizations/{orgId}/members/{uid}
  - role: "admin" | "member"
  - email: string
  - displayName: string
  - joinedAt: timestamp

invites/{token}                    // トップレベル。招待された側はまだorgIdを
  - orgId: string                  // 知らないので、token単体で引けるようにする
  - orgName: string                // (組織のサブコレクションだとorgIdが先に要る)
  - email: string
  - role: "admin" | "member"
  - status: "pending" | "accepted" | "revoked" | "expired"
  - invitedBy: uid
  - createdAt: timestamp
  - expiresAt: timestamp

organizations/{orgId}/tasks/{taskId}
  - title: string
  - description: string
  - status: "todo" | "in_progress" | "done"
  - assigneeId: uid | null
  - assigneeName: string | null   // 表示用に非正規化(JOINできないため)
  - dueDate: date | null
  - createdBy: uid
  - createdAt: timestamp
  - updatedAt: timestamp

users/{uid}                        // トップレベル。org横断の逆引き専用
  - email: string
  - orgId: string
```

`organizations/{orgId}/...` というサブコレクション構成にしている理由: **パスそのものに orgId を含めることで、「別組織のデータに書き込むつもりが orgId を書き忘れて事故る」という種類のミスを構造的に防げる**(SQLで言う「tenant_id を書き忘れる」問題に相当。詳細は4章)。

---

## 3. セキュリティルールの考え方(概要)

- 読み書きの許可条件は基本的に `request.auth.token.orgId == orgId`(Custom Claims による高速判定)
- ロール変更・招待発行などの重要操作は、クライアントから直接 Firestore に書き込ませず、**Next.js の API Route(Admin SDK)を必ず経由させる**。API Route 側で Firestore の最新の role(正データ)を読み直して認可判定を行い、Custom Claims もそこで更新する
- これにより「セキュリティルールだけで完結させる薄い認可」と「重要操作はサーバーでダブルチェックする厚い認可」の二層構造になる(多層防御)

具体的なルール文言・API Route の実装は、実装フェーズで一緒に書きながら詳細化する。

---

## 4. SQL(リレーショナルDB)で同じものを設計したら

### 4.1 設計方針

- 認証情報(パスワード等)は Firestore 実装と同様、自前のDBには持たせず、Firebase Auth のような外部IDプロバイダに委譲する想定。SQL側の `users` テーブルは「認証を通過した人の台帳」であり、`id` は Firebase の `uid` などの外部認証IDをそのまま主キーとして使う
- 「組織」「ユーザー」「所属」を分離した正規化設計にする。これは **1ユーザーが将来複数組織に所属する可能性がある一般的なSaaSパターン**を見据えた設計。今回の要件(1ユーザー1組織)は「所属テーブルに `UNIQUE(user_id)` を張る」ことで表現する — テーブル構造自体は多対多に対応した形のまま、ビジネスルールを制約で縛る、という考え方
- ロール(`admin`/`member`)は種類が2つしかなく増える見込みも薄いため、別テーブルに切らず `memberships.role` に `CHECK` 制約付きの文字列(または ENUM 型)として持たせる。ロールごとに追加属性(権限一覧など)を持たせたくなったら、その時点で `roles` テーブルへ正規化すればよい(YAGNI)

### 4.2 テーブル定義(PostgreSQL想定)

```sql
-- 組織(テナント)
CREATE TABLE organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ユーザー(認証情報自体は外部IDプロバイダが保持。ここは台帳)
CREATE TABLE users (
  id            UUID PRIMARY KEY,              -- Firebase の uid 等、外部認証IDをそのまま使う
  email         TEXT NOT NULL UNIQUE,
  display_name  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 所属 + ロール(組織とユーザーの中間テーブル)
CREATE TABLE memberships (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (organization_id, user_id),  -- 同じ組織に二重登録されない
  UNIQUE (user_id)                    -- ★今回の要件: 1ユーザー1組織のみ
);

-- 招待
CREATE TABLE invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  token           TEXT NOT NULL UNIQUE,
  status          TEXT NOT NULL CHECK (status IN ('pending','accepted','revoked','expired')) DEFAULT 'pending',
  invited_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ NOT NULL
);

-- タスク
CREATE TABLE tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL CHECK (status IN ('todo','in_progress','done')) DEFAULT 'todo',
  assignee_id     UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date        DATE,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- インデックス: テナント分離クエリを高速化する複合インデックス
-- 「organization_id を必ず先頭に置く」のが鉄則(4.4節で詳述)
CREATE INDEX idx_tasks_org_status   ON tasks (organization_id, status);
CREATE INDEX idx_tasks_org_assignee ON tasks (organization_id, assignee_id);
CREATE INDEX idx_memberships_org    ON memberships (organization_id);
```

### 4.3 正規化の考え方(なぜこの形にしたか)

- **第1正規形**: 1セル1値になっている(例: タスクの担当者を複数人カンマ区切りで1カラムに詰め込んだりしない)
- **第2/3正規形**: `memberships` を独立させたことで、「組織名」を `users` テーブルに直接持たせるような**推移的関数従属**を排除している。もし `users.organization_name` のようなカラムを持たせると、組織名変更時に全ユーザー行を更新する必要が出て矛盾のもとになる
- 多対多(本来ユーザーは複数組織に所属しうる)を **中間テーブル(memberships)** で表現するのはリレーショナル設計の基本パターン。Firestore側で `organizations/{orgId}/members/{uid}` というサブコレクションにしたのと概念的には同じ役割

### 4.4 アンチパターン集

実務でよく見る失敗パターンと、それがなぜ危険か。

1. **`organization_id` にインデックスを張らない / 複合インデックスの先頭に置かない**
   テナント分離のクエリは必ず `WHERE organization_id = ? AND ...` の形になる。ここにインデックスが無いと、テーブルが育つほど全件スキャンになり、他テナントの行まで一度読み込んでからフィルタする形になる(パフォーマンス問題だけでなく、実装ミスでWHERE句が漏れた時の被害も大きくなる)

2. **アプリケーションコードだけでテナント分離を担保する**
   「WHERE organization_id = :currentOrgId を書き忘れなければ安全」という設計は、書き忘れた瞬間に全テナントのデータが見えてしまう。PostgreSQLならRow Level Security(RLS)でDB側にも防御線を張るのが望ましい(Firestoreのセキュリティルールに相当する役割)

3. **ロールを自由入力の文字列で持つ**
   `role = 'Admin'` と `role = 'admin'` が表記ゆれで別物として扱われる、typoで意図しない値が入る、といった事故が起きる。`CHECK` 制約や ENUM 型で許容値を強制するべき

4. **多対多を無理やり1対多で表現する**
   例えば `users.organization_id` を直接持たせてしまうと、将来「1人が複数組織に所属する」要件が出た瞬間に破綻する(今回は要件上1対1に制約しているが、それは `memberships` テーブル+UNIQUE制約で表現し、テーブル構造自体は多対多に対応できる形を保っている、という点がポイント)

5. **外部キー制約を省略する**
   「アプリ側でちゃんとチェックしてるから大丈夫」という設計は、バグや直接のDB操作で簡単に破られる。孤立した `tasks` 行(存在しない `organization_id` を指す)のようなデータ不整合が静かに蓄積する

6. **認証情報(パスワード)を自前のテーブルに平文/自前ハッシュで持つ**
   ソルト付きハッシュ化、ブルートフォース対策、パスワードリセットフローなど、認証は専門領域。自前実装よりFirebase AuthのようなIDプロバイダに委譲する方が安全

7. **EAV(Entity-Attribute-Value)パターンの濫用**
   「タスクにカスタム項目を自由に追加したい」という要求に対し、`task_attributes(task_id, key, value)` のような何でも入る汎用テーブルで対応すると、型安全性が失われクエリが著しく複雑化する。要件が明確なうちはカラムとして素直に定義するべき

8. **論理削除(`is_deleted`フラグ)とUNIQUE制約の組み合わせミス**
   例えば `email` に `UNIQUE` を張ったまま論理削除を導入すると、「退会済みだが同じメールアドレスで再登録できない」という事故が起きる。部分インデックス(`WHERE is_deleted = false` 条件付きUNIQUE)などで対応する必要がある

9. **N+1クエリ**
   タスク一覧を取得したあと、担当者名を1件ずつ別クエリで取りに行く実装。JOINで一括取得すべき(SQLの得意分野。Firestoreだとそもそも構造的にJOINできないため、後述のように非正規化で回避する)

---

## 5. NoSQL(Firestore) と SQL、何が楽で何が面倒か

| 観点 | SQL | Firestore(NoSQL) |
|---|---|---|
| データ整合性の保証 | 外部キー制約で**楽** | アプリ側で気をつける必要があり**面倒** |
| スキーマ変更 | マイグレーションが必要で**面倒** | ドキュメントに自由にフィールド追加できて**楽** |
| 複数テーブルをまたぐ集計・JOIN | 1クエリで書けて**楽** | JOINが無く複数回読み取り+非正規化が必要で**面倒** |
| リアルタイム画面更新 | 自前でWebSocket基盤等が必要で**面倒** | `onSnapshot` が標準搭載で**楽** |
| クライアントからの直接アクセス制御 | 必ずAPIサーバーを経由するのでDB自体はシンプルで**楽** | クライアントが直接読み書きする前提なのでセキュリティルールを厳密に書く必要があり**面倒** |
| 権限変更の反映タイミング | APIが毎回最新のDBを見るので即時反映で**楽** | Custom Claimsのキャッシュ遅延があり**面倒** |
| 書き込みの水平スケール | シャーディング等の設計が必要になりがちで**面倒** | ドキュメント単位で自然にスケールして**楽** |
| ローカルでのルール検証 | 通常のテストで十分 | セキュリティルール専用のエミュレータテストが別途必要で**面倒** |

一言でまとめると: **SQLは「型と整合性に守られる代わりに変更コストが高い」、Firestoreは「身軽に変更できる代わりに整合性と分離を自分で守る責任が重い」**。今回のようにマルチテナントで権限の厳密さが求められるアプリでは、Firestoreを選んだ時点で「セキュリティルールと非正規化データの一貫性管理」に普段以上の注意を払う必要がある、というのが一番の学び。

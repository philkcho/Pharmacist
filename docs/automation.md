# Automation Overview — AI PharmCare

> 사이트가 자동으로 돌아가는 모든 작업, 어떤 일을 하는지, 자동 실행 후 운영자(Younghun)가 해야 할 일을 한 페이지에 정리. 매번 새 cron이나 자동 작업이 추가될 때 이 문서를 같이 갱신.

---

## 모든 자동 작업의 결과 알림

모든 cron route는 실행 후 결과 요약을 **`aipharmcare@gmail.com`** 으로 자동 발송합니다 (성공·실패 모두).

- 발송 대상: `CRON_REPORT_EMAIL` 환경변수 (기본값 `aipharmcare@gmail.com`)
- 비활성: `CRON_REPORT_DISABLED=1` 환경변수 설정 시 OFF
- 발송 주체: `src/lib/messaging/send-cron-report.ts`
- 적용 방식: `src/lib/messaging/with-cron-report.ts` 가 GET 핸들러를 감싸서 실행 후 자동 호출
- 메일 제목 패턴: `[✅ OK | ❌ FAIL] AI PharmCare cron — <route> (Xs)`
- 본문: 시작/종료 시각 + 소요 시간 + JSON 응답 전체

---

## 자동 작업 목록

### 1. `digest` — 사용자 디지스트 메일 발송 ⭐ 핵심
- **위치**: Vercel Cron
- **Schedule**: 매일 `00:00 UTC` (= 09:00 KST)
- **경로**: `/api/cron/digest`
- **하는 일**:
  - `email_subscribers` 중 `unsubscribed_at IS NULL` 인 모든 구독자 조회
  - 각 구독자의 `frequency` 와 오늘 요일 매칭:
    - `weekly` → 월요일에만 발송 (3-5건 묶음)
    - `3x_week` → 월/수/금만 (1건)
    - `daily` → 매일 (1건)
    - `critical_only` → 이 cron에서는 skip (별도 트리거 예정)
  - 각 구독자별로 `digest_log` 30일 dedup 적용 → 새 콘텐츠만 picks
  - `Resend`로 메일 발송, 성공한 picks 는 `digest_log` 에 기록
- **응답 예**:
  ```json
  { "ok": true, "todayUtcDay": 1, "attempted": 12, "sent": 11,
    "skippedNoItems": 0, "failureCount": 1, "failures": [...] }
  ```
- **운영자 후속**:
  - `failureCount > 0` 이면 받은 메일에서 실패 이유 확인 (대부분 invalid email).
  - Resend 무료 한도 (3,000/월, 100/일) 근접하면 Pro $20 업그레이드.
  - 첫 실제 사용자가 받은 후 본인 메일로 가서 디자인·링크·unsubscribe 동작 직접 검증.

### 2. `weekly` — 트렌드 수집 + 분석
- **위치**: GitHub Actions (`.github/workflows/cron.yml`)
- **Schedule**: 매일 `09:00 UTC` (= 18:00 KST)
- **경로**: `/api/cron/weekly`
- **하는 일**:
  - **월요일에만**: `ingestWeeklyTrends()` 실행 → Google Trends 신규 키워드를 `trend_topics`에 `pending` 으로 insert.
  - **매일**: `analyzePendingTrends(limit=3)` → pending 트렌드 3개를 3-Layer AI (분류 → retrieve → synthesize) 처리, 자동 publish.
- **운영자 후속**:
  - 새 트렌드 아티클이 자동 게시되면 `/admin/trends` 또는 사이트에서 품질 확인.
  - 부적절한 트렌드는 `/admin/trends` 에서 unpublish.
  - 분석 실패 (응답 메일 `errors[]` 비어있지 않으면) 원인 확인 — 보통 PubMed API 일시 장애 또는 Gemini quota.

### 3. `products` — 시드 제품 배치 처리
- **위치**: GitHub Actions
- **Schedule**: 매일 `10:00 UTC` (= 19:00 KST)
- **경로**: `/api/cron/products?limit=20`
- **하는 일**:
  - `src/lib/data/product-seed-list.ts` 에서 아직 처리 안 된 제품 다음 20개:
    1. FDA 라벨 fetch (OTC drug)
    2. 실제 제품 사진 검색 (Google CSE → Bing fallback)
    3. AI 분석 (verdict, pros/cons, 성분, 점수, usage guide)
    4. medications 테이블 insert + 자동 approved
    5. 구매 링크 생성
- **운영자 후속**:
  - `result.failed[]` 에 들어있는 항목은 보통 FDA 라벨 미등록 (보충제·화장품) → 정상.
  - 시드 리스트가 다 소진되면 더 이상 새 제품 안 들어옴 → `product-seed-list.ts` 에 추가하거나 cron 비활성.
  - Gemini 무료 일일 한도 도달 시 일부만 처리되고 다음날 이어감 — 정상 동작.

### 4. `fill` — 불완전 제품 채우기
- **위치**: GitHub Actions
- **Schedule**: 매일 `11:00 UTC` (= 20:00 KST)
- **경로**: `/api/cron/fill?limit=15`
- **하는 일**:
  - `medications` 중 image / verdict / analysis / 구매링크 중 빠진 게 있는 제품 15개를 `ensureProductComplete()` 로 갱신.
  - `weekly`, `products` 배치가 미처 못 끝낸 항목들 따라잡기.
- **운영자 후속**:
  - 응답의 `stats` 필드로 남은 incomplete 제품 수 추적.
  - 0에 가까워지면 cron 줄여도 OK (월 1회 정도로).

### 5. `seo-content` — SEO 페이지 자동 생성
- **위치**: GitHub Actions
- **Schedule**: 매일 `12:00 UTC` (= 21:00 KST)
- **경로**: `/api/cron/seo-content`
- **하는 일**: 매일 자동 생성:
  - **Safety articles** 3개 → `/is-safe/[slug]` ("Is X safe?" Q&A)
  - **Comparisons** 2개 → `/vs/[a]-vs-[b]` (같은 type 상위 6개 조합)
  - **Ingredient guides** 2개 → `/ingredients/[slug]`
  - 합계 ~210 페이지/월. 인덱싱 풀 확장 핵심.
- **운영자 후속**:
  - 결과 메일에서 생성 실패 항목 확인.
  - 이미 모든 조합이 다 만들어지면 `result.created=0` → 시드 추가 또는 cron 비활성.
  - 부정확/저품질 페이지 발견 시 수동 삭제 (`product_comparisons`, `ingredient_guides`, `medications.safety_article_jsonb`).

### 6. `refresh-top-products` — 분기별 featured 제품 갱신
- **위치**: GitHub Actions
- **Schedule**: 매 분기 1일 `02:00 UTC` (1월/4월/7월/10월)
- **경로**: `/api/cron/refresh-top-products`
- **하는 일**:
  - `is_featured = true` 이고 90일 이상 안 갱신된 제품 최대 30개:
    - 이미지 URL 재검색 (리테일러 이미지 URL이 변경되거나 dead link 됨)
    - 구매 링크 재생성 (제품 단종 / 신규 리테일러)
- **운영자 후속**:
  - 실패한 제품은 사이트에서 manual하게 admin/medications에서 재처리.
  - `errors > 5` 이면 Google CSE quota 또는 Bing API 이슈 — 별도 점검.

---

## 자동 작업 외 — 사용자 트리거 자동화

### `email_subscribers` 가입
- **트리거**: 사용자가 footer 폼 / Subscribe sheet / `/subscribe` 페이지에서 이메일 입력.
- **자동 동작**:
  - `POST /api/subscribe` → `email_subscribers` upsert (frequency='weekly', source 기록).
  - 새로 발급된 `unsub_token`으로 1-click unsubscribe URL 자동 활성화.
- **운영자 후속**:
  - 별도 작업 없음. 다음 cron 발송 사이클에서 자동 포함됨.

### Unsubscribe
- **트리거**: 메일의 List-Unsubscribe 헤더 (Gmail/Outlook 1-click 버튼) 또는 본문 unsubscribe 링크 클릭.
- **자동 동작**: `email_subscribers.unsubscribed_at` 업데이트. cron이 자동 제외.
- **운영자 후속**: 없음.

### 제품 분석 페이지 lazy fill
- **트리거**: 사용자가 새 제품 명을 콘텐츠에서 만나면 `ensureProductComplete()` 자동 호출.
- **자동 동작**: 이미지 + FDA + AI 분석 + 구매링크 채워짐.
- **운영자 후속**: 없음 (자동 approved). 부적합한 자동 생성 발견 시 `/admin/medications` 에서 reject.

---

## 실행 결과 모니터링

### 메일 받은 편지함 (`aipharmcare@gmail.com`)
- 매일 6-7통 (성공 시): `digest`, `weekly`, `products`, `fill`, `seo-content`. 분기별 1번 더 (refresh).
- ✅ OK 메일은 빠르게 훑고 통계만 확인.
- ❌ FAIL 메일은 `summary.error` 또는 `failures[]` 확인 후 대응.
- 너무 많아지면 Gmail 필터 → "Cron Reports" 라벨로 이동.

### Vercel Dashboard
- **Cron Jobs** 탭 → digest cron 다음 실행 시간 + 실행 이력.
- **Logs** 탭 → 함수 실행 로그 (디버깅 시 활용).

### GitHub repo Actions 탭
- 5개 cron의 schedule 실행 이력.
- 실패 시 GitHub 가입 이메일로 자동 알림 (Settings → Notifications → Actions에서 끌 수 있음).
- workflow_dispatch 로 어떤 cron이든 즉시 수동 실행 가능.

---

## 작업 추가/변경 시 갱신 체크리스트

새 cron이나 자동 작업을 추가할 때 매번 이 체크리스트를 따라가세요:

1. **route 또는 워커 작성** (`src/app/api/cron/<name>/route.ts`).
2. `withCronReport("<name>", handler)` 로 GET을 wrap → 자동 메일 알림 활성.
3. `vercel.json` (Vercel 위) 또는 `.github/workflows/cron.yml` (GitHub Actions 위) 에 schedule 추가.
   - Vercel Hobby 한도: 2 daily cron jobs.
   - GitHub Actions: 무료 무제한.
4. 새 cron이 환경변수 / DB 마이그레이션 / 서드파티 API 키를 추가로 요구하면:
   - `.env.local` 에 추가.
   - Vercel 환경변수에 동일하게 추가 (Settings → Environment Variables).
   - 필요 시 GitHub Secrets에도 추가.
5. **이 문서에 새 작업 entry 추가**.
6. 첫 실행을 manual trigger (workflow_dispatch 또는 curl)로 검증.

---

## 환경변수 요약 (Production = Vercel + GitHub Secrets)

| 변수 | 어디서 사용 | 비고 |
|---|---|---|
| `RESEND_API_KEY` | digest, sendCronReport | Resend 발송 |
| `RESEND_FROM_EMAIL` | digest, sendCronReport | `hello@aipharmcare.com` |
| `CRON_REPORT_EMAIL` | sendCronReport | 기본값 `aipharmcare@gmail.com` |
| `CRON_REPORT_DISABLED` | sendCronReport | `1` 설정 시 cron 알림 OFF |
| `CRON_SECRET` | 모든 cron route | GitHub Actions ↔ Vercel 인증 |
| `NEXT_PUBLIC_SUPABASE_URL` | 전 영역 | Supabase 프로젝트 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | 모든 server action | RLS 우회 |
| `GOOGLE_GENERATIVE_AI_API_KEY` | weekly, products, fill, seo-content | Gemini |
| `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` | products, fill, refresh-top-products | 제품 이미지 검색 |
| `OPENFDA_API_KEY` | weekly, products | FDA 라벨/FAERS/리콜 |

---

## 향후 추가 예정 (현재 미구현)

- **Telegram Bot 채널** (`/api/cron/digest` 가 frequency 별 chat_id 로 발송) — Phase 2 후속.
- **Web Push (PWA)** — iOS 16.4+ 사용자 대상.
- **Critical-only alert cron** — recall / drug interaction 발견 시 즉시 push.
- **카카오톡 알림톡** — 한국어 카테고리 출시 시.

각 작업 추가 시 이 문서에 entry 늘려가며 운영하시면 됩니다.

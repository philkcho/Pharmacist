@AGENTS.md

# Dr.pharmacist 프로젝트

Health & Beauty 트렌드를 AI로 분석하고, 약사가 검토하며, 관련 제품 구매로 연결하는 영어 웹사이트.

## 기술 스택
- **프레임워크:** Next.js 16 (App Router)
- **배포:** Vercel
- **DB:** Supabase (PostgreSQL)
- **ORM:** Drizzle ORM
- **인증:** Supabase Auth (약사/일반 사용자 역할)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **LLM:** Vercel AI SDK + Google Gemini 2.5 Flash
- **SEO:** Next.js Metadata API + next-sitemap
- **유효성 검사:** Zod
- **다국어:** next-intl (영어 우선, 향후 확장)
- **패키지 매니저:** pnpm

## 규칙
- 커뮤니케이션과 문서는 **한국어**로 작성
- 코드(변수명, 함수명)와 사이트 콘텐츠는 **영어**로 작성
- 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 반드시 확인
- 제품 추천 시 "Recommended" 대신 "Related Products" 프레이밍 사용
- 약사 미승인 제품은 공개 페이지에 노출 금지 (`approval_status = 'approved'` 필터 필수)
- **Supabase DB는 반드시 `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL` 참조** (project_id: `rlemyrdivdwibooxbugq`). MCP `list_projects` 결과 맹신 금지.

---

## 프로젝트 아키텍처

### 사용자 흐름

```
홈페이지 (/)
├── 검색바 (히어로 + 헤더 상시)
├── Worth the Hype? — 최신 트렌드 아티클 3개 (카드, 클릭 유도 headline)
│   └── 클릭 → /trending/[slug] 아티클 상세
├── Dr.'s Analysis — YouTube 기반 Dr.pharmacist 자체 연구 아티클 3개
│   └── 클릭 → /expert/[slug] 상세
├── What Are You Looking For? — Health/Beauty 토픽 카드
│   └── 클릭 → /topics/[keyword]
└── View All (각 섹션) → /trending, /expert 인덱스

검색 (/search?q=...)
├── 트렌드 아티클 매칭
└── 제품 매칭

트렌드 아티클 (/trending/[slug])
├── Hook (rank, velocity, trend drivers)
├── 1-Minute Read (200-250 단어 leadExplanation)
├── Key Takeaways (3-5 bullets)
├── Related Products (조건부, 약사 승인 제품만)
├── Ingredient Deep Dive
├── Safety (FAERS 부작용, FDA 리콜, redFlags)
├── People Ask Next (followUpQuestions)
├── Related Queries
├── Sources (tier 1/2/3 그룹핑)
├── Limitations
└── 본문 내 키워드 자동 링크 → /topics/[keyword]

토픽 페이지 (/topics/[keyword])
├── 리테일러별 상위 제품 5개 (한줄 가로 스크롤)
│   └── 각 제품: 사진 + 이름 + 가격 + [Analyze] + [Buy]
├── Pharmacist-Reviewed 제품 (DB approved)
└── 관련 트렌드 아티클

제품 분석 (/analysis/[slug])
├── 제품 헤더 (사진 + 이름 + [Buy on Amazon] 버튼)
├── Pharmacist's Verdict
├── Ingredient Analysis (성분별 카드, Professional Details 접기)
├── Pros & Cons
├── Safety Information (Warnings + Side Effects)
├── Research & References
└── Sticky Buy Bar (DB purchase_links 있을 때만)

Dr.'s Analysis (/expert/[slug])
├── Header (카테고리, 제목, read time — 저자 정보 없음)
├── Popular Features (Quick Nav — Summary/Study Notes/Products 바로가기)
├── TL;DR (summary)
├── Key Takeaways
├── Analysis Sections (본문)
├── Proper Notes (학습 노트)
├── Mentioned Products (핵심 CTA, 강조)
│   ├── [View Analysis] → /analysis/[slug]
│   └── [Shop Options] → /topics/[shopKeyword]
└── Disclosure (AI 고지, 원본 영상 링크 없음)
```

### 데이터 파이프라인

```
Google Trends (주 1회, 월요일)
  → ingestWeeklyTrends() — trend_topics 테이블에 pending 저장
  → analyzeTrend() — Layer 1 (classify) + Layer 2 (retrieve) + Layer 3 (synthesize)
     ├── Health: FDA labels + FAERS + Recalls + PubMed + Recent PubMed (30일)
     ├── Beauty: Open Beauty Facts + PubMed + AAD/DermNet
     └── 성공 시 auto-publish (pharmacist_reviewed=false, amber 배너)
  → generateTrendImageUrl() — Pollinations.ai로 커버 이미지 자동 생성
  → matchProducts() — DB에서 approved 제품 매칭 (최대 3개)
  → persistBeautyProducts() — OBF 제품을 draft로 저장 (약사 승인 대기)
  → autoGeneratePurchaseLinks() — 리테일러별 검색 URL 자동 생성

제품 배치 파이프라인 (매일 10:00 UTC, /api/cron/products)
  → processProductBatch(limit=20) — 시드 리스트에서 N개 제품 처리
     ├── FDA 데이터 fetch (OTC 약품)
     ├── fetchRealProductImage() — 실제 제품 사진 검색 (Google CSE → Bing)
     ├── analyzeProduct() — AI 분석 (verdict, pros, cons, 성분, 점수)
     ├── medications 테이블에 draft로 저장
     └── autoGeneratePurchaseLinks() — 구매 링크 생성
  → 시드 리스트: src/lib/data/product-seed-list.ts (~110개)

완전성 보장 유틸리티 (src/lib/actions/ensure-product-complete.ts)
  → ensureProductComplete(name) — 제품 데이터 완전성 보장
     ├── DB에 없으면 생성 (FDA + 이미지)
     ├── 이미지 없으면 실제 사진 검색 (fetchRealProductImage)
     ├── AI 분석 없으면 실행 (pros/cons/verdict/성분)
     └── 구매 링크 없으면 생성
  → 사용처: Expert Picks mentionedProducts, 모든 신규 제품 surface
  → 목적: 빈 카드/빈 분석 UI 제거 (고객에게 공백 화면 노출 방지)
```

### 제품 이미지 정책

**원칙: 실제 제품 사진만 사용. AI 생성 이미지 금지.**
잘못된 제품 사진은 placeholder보다 나쁘다 — 신뢰도 훼손.

```
이미지 소싱 우선순위:
  1순위: Google Custom Search API (GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX)
         → 100회/일 무료, 공식 API, Amazon/iHerb 등 실제 사진
  2순위: Bing Image Search (API 키 불필요, web scrape fallback)
         → Amazon, iHerb, Walmart 등 리테일 소스 우선 선택
  ✗ 금지: Pollinations.ai, DALL-E, 기타 AI 이미지 생성

이미지 저장: Supabase Storage (public-images/products/<slug>.jpg)
  → CDN URL을 medications.image_url에 저장
  → 한번 저장되면 이후 즉시 로드 (Pollinations처럼 매번 생성 안 함)

구현 파일:
  - src/lib/images/search-product-image.ts — fetchRealProductImage()
  - ensureProductComplete()가 자동 호출
  - 이미지 못 찾으면 null → UI에서 Pill 아이콘 placeholder 표시
```

### 안전 게이트 (3중)

1. **RLS 정책** (DB): `approval_status = 'approved' OR is_pharmacist()` — 미승인 제품 공개 차단
2. **matchProducts()**: `.eq('approval_status', 'approved')` 필터
3. **UI 프레이밍**: "Related Products" + "Consult your pharmacist" + 제휴 공시

---

## 주요 테이블

### trend_topics
Google Trends에서 수집한 트렌드 키워드. `status` 상태 머신: pending → analyzing → published/rejected.

### trend_analyses (1:1 with trend_topics)
3-Layer AI 분석 결과:
- `understanding_jsonb` — Layer 1: topicType, entities, intent
- `sources_jsonb` — Layer 2: SourceFragment[] (tier 1/2/3)
- `synthesis_jsonb` — Layer 3: answer, leadExplanation, keyTakeaways, redFlags, trendDrivers, headline, claims, confidence, limitations, followUpQuestions
- `product_matches_jsonb` — ProductMatch[]
- `market_reaction_jsonb` — relatedQueries, velocityScore, topReactions (FAERS), activeRecalls, recentPubmedStudies

### medications
제품 마스터 테이블. `product_type`: otc_drug | supplement | cosmetic | quasi_drug. `approval_status`: draft | pending_review | approved | rejected.

주요 필드: name, slug, genericName, brandNames, ingredientAnalysis (JSONB, consumer/professional 이중 레이어), pros, cons, verdict, warnings, sideEffects, priceRange, imageUrl, images (JSONB 다중 이미지), purchaseLinks, inciList, skinTypes, skinConcerns.

### retailers
리테일러 마스터: Amazon, iHerb, StyleKorean, YesStyle. affiliateNetwork, commissionRate.

### product_purchase_links
medications ↔ retailers 정규화 조인. url, affiliateUrl, price.

### purchase_click_events
클릭 추적 로그. `/api/click/[linkId]` 경유 302 리다이렉트.

### expert_picks
Dr.'s Analysis — YouTube 트랜스크립트를 원재료로 **Dr.pharmacist 자체 연구 아티클**로 재작성하는 콘텐츠. 독자는 영상 출처를 모르게 함.

주요 필드:
- 관리자 메타데이터: `youtubeUrl`, `youtubeId`, `expertName`, `expertCredential` (본문 노출 금지)
- 공개 본문: `title`, `category` (health/skin-care/wellness), `summary`, `keyTakeaways`, `analysisSections`, `properNotes`, `mentionedProducts`
- 기타: `transcript`, `cleanTranscript` (DB 저장, UI 비노출), `status` (draft/published/rejected), `thumbnailUrl` (카드용)

**mentionedProducts 각 항목**:
- `name` — 브랜드 포함 제품명 (성분 단독 불가)
- `reason` — 왜 중요한지 1줄
- `slug` — `ensureProductComplete()`로 DB 등록 후 부여
- `shopKeyword` — `/topics/[keyword]` 페이지 이동용 (e.g. "probiotics", "face moisturizer")

### Dr.'s Analysis 보이스 규칙 (AI 생성 시 필수)

**적용**: title, summary, keyTakeaways, analysisSections, properNotes, mentionedProducts.reason
**예외**: `cleanTranscript` (원본 화자 보존, UI 비노출)

1. **독립 연구 톤** — Dr.pharmacist 자체 연구 아티클처럼. 영상/화자/채널 레퍼런스 금지 ("he explains", "in this video", "from [channel]" 등).
2. **"overseas/foreign/imported" 표현 금지** — 독자는 미국인이므로 한국 기준 "해외 제품"은 독자에게 국내 제품.
3. **한국 특화 컨텍스트 금지** — "K-beauty" 같은 정착 카테고리 외 한국 시장/규제/유통 레퍼런스 배제.
4. **expertName/expertCredential 본문 노출 금지** — 관리자 메타데이터 전용.

구현: `src/lib/ai/analyze-expert-video.ts`의 시스템 프롬프트 "CRITICAL VOICE RULES" 섹션 + 각 Zod 필드 description.

### 공개 상세 페이지 섹션 구조 (`/expert/[slug]`)
1. Back link (`← All Dr.'s Analysis`)
2. Header — 카테고리 뱃지, 큰 제목, ~N min read (저자 정보 노출 안 함)
3. **Popular Features** (목차 / Quick Nav 3개 버튼)
   - 요약 → `#summary`
   - 학습 노트 → `#notes`
   - 언급된 제품 → `#products`
4. TL;DR (summary)
5. Key Takeaways (checkmark 리스트)
6. Analysis Sections (본문)
7. Proper Notes (학습 노트)
8. **Mentioned Products** (핵심 CTA — primary 보더 박스로 강조)
   - 각 카드에 두 개의 버튼
   - `[🧪 View Analysis]` → `/analysis/[slug]` (제품 상세)
   - `[🛒 Shop Options]` → `/topics/[shopKeyword]` (리테일러별 구매)
9. Disclosure (간단한 AI 고지 + 제휴 고지, 원본 영상 출처 링크 없음)

### 삭제된 요소 (아티클 톤 유지 목적)
- 큰 커버 이미지 블록 (DrCover는 홈/인덱스 카드용으로만 유지)
- "More Content" / Feature Sections 아코디언
- Clean Transcript 공개 노출 (DB 저장은 유지)
- Disclosure 내 "Original source" YouTube 링크
- `content_creation` 카테고리

---

## 주요 파일 맵

### AI & Analysis
- `src/lib/ai/types.ts` — TopicUnderstanding, SourceFragment, Analysis, ProductMatch, MarketReaction
- `src/lib/ai/classify-topic.ts` — Layer 1: 토픽 분류 + 엔티티 추출
- `src/lib/ai/synthesize-analysis.ts` — Layer 3: Gemini 합성 (answer, leadExplanation, headline, keyTakeaways, redFlags, trendDrivers)
- `src/lib/ai/match-products.ts` — 제품 매칭 (drug name → generic → category, approved만)
- `src/lib/ai/identify-product.ts` — 이미지 OCR (Gemini Vision)
- `src/lib/ai/analyze-product.ts` — 제품 AI 분석 (verdict, pros, cons, 성분, 점수, 추천 대상)
- `src/lib/ai/analyze-expert-video.ts` — YouTube 트랜스크립트 분석 (Dr.'s Analysis)
- `src/lib/ai/generate-trend-image.ts` — Pollinations.ai 트렌드 커버 이미지
- `src/lib/ai/generate-product-image.ts` — Pollinations.ai 제품 이미지

### Retrieval (Layer 2)
- `src/lib/retrieval/types.ts` — SourceFetcher, RetrievalInput, FetcherResult
- `src/lib/retrieval/merge-and-rank.ts` — 소스 통합 + 정렬
- `src/lib/retrieval/fetch-fda-facts.ts` — openFDA 라벨 (Tier 1)
- `src/lib/retrieval/search-pubmed.ts` — PubMed 리뷰 논문 (Tier 1)
- `src/lib/retrieval/search-pubmed-recent.ts` — PubMed 최근 30일 (Tier 1, trending hook용)
- `src/lib/retrieval/fetch-open-beauty-facts.ts` — OBF 제품 카탈로그 (Tier 2) + persistBeautyProducts()
- `src/lib/retrieval/fetch-db-facts.ts` — DB 캐시 팩트
- `src/lib/retrieval/curated-sources.ts` — 수동 큐레이션 소스

### FDA Clients
- `src/lib/fda/client.ts` — openFDA 라벨 API (getBestOtcLabel)
- `src/lib/fda/faers-client.ts` — FAERS 부작용 보고 (상위 5개, 7일 캐시)
- `src/lib/fda/enforcement-client.ts` — FDA 리콜 현황 (24시간 캐시)

### Server Actions
- `src/lib/actions/trends.ts` — 트렌드 수집/분석/발행, getTrendBySlug, listPublishedTrendsWithHeadline
- `src/lib/actions/medications.ts` — 제품 CRUD, getOrFetchMedication (FDA 캐시), 승인 큐 (approveProduct, rejectProduct)
- `src/lib/actions/topics.ts` — 토픽 페이지 데이터 (제품 매칭 + 리테일러별 샘플 + 구매 링크)
- `src/lib/actions/analysis.ts` — 제품 분석 페이지 데이터 (성분, 장단점, safety)
- `src/lib/actions/retailers.ts` — 리테일러/구매 링크 CRUD
- `src/lib/actions/purchase-links.ts` — autoGeneratePurchaseLinks (제품 저장 시 리테일러 검색 URL 자동 생성)
- `src/lib/actions/articles.ts` — 약사 수동 아티클
- `src/lib/actions/categories.ts` — 카테고리 CRUD
- `src/lib/actions/expert-picks.ts` — YouTube 기반 Dr.'s Analysis (createExpertPick)
- `src/lib/actions/product-batch.ts` — 시드 리스트 기반 제품 일괄 생성 (processProductBatch, getSeedProgress)
- `src/lib/actions/ensure-product-complete.ts` — **제품 데이터 완전성 보장** (이미지+FDA+AI분석+구매링크). 빈 화면 방지 핵심 유틸
- `src/lib/data/product-seed-list.ts` — 인기 OTC/서플/뷰티 제품 시드 (~110개)

### Public Pages
- `src/app/[locale]/(public)/page.tsx` — 홈 (히어로 + 검색 + Worth the Hype? + Dr.'s Analysis + What Are You Looking For?)
- `src/app/[locale]/(public)/trending/page.tsx` — 트렌드 인덱스
- `src/app/[locale]/(public)/trending/[slug]/page.tsx` — 트렌드 아티클 상세
- `src/app/[locale]/(public)/expert/page.tsx` — Dr.'s Analysis 인덱스
- `src/app/[locale]/(public)/expert/[slug]/page.tsx` — Dr.'s Analysis 상세 (독립 연구 톤 적용)
- `src/app/[locale]/(public)/topics/[keyword]/page.tsx` — 토픽 (리테일러별 제품 + 분석/구매 버튼)
- `src/app/[locale]/(public)/analysis/[slug]/page.tsx` — 제품 분석 상세 (성분, 장단점, sticky buy bar)
- `src/app/[locale]/(public)/search/page.tsx` — 검색 결과
- `src/app/[locale]/(public)/compare/` — 제품 비교 (카테고리별)

### Admin Pages
- `src/app/[locale]/(admin)/trends/` — 트렌드 관리 (pending/published/rejected)
- `src/app/[locale]/(admin)/approval-queue/` — 약사 승인 큐 (draft → approved/rejected)
- `src/app/[locale]/(admin)/retailers/` — 리테일러 관리 (CRUD, 제휴 정보)
- `src/app/[locale]/(admin)/medications/` — 제품 CRUD + Import Samples + Generate Images
- `src/app/[locale]/(admin)/review-requests/` — 사용자 리뷰 요청 큐
- `src/app/[locale]/(admin)/articles/` — 약사 아티클 관리
- `src/app/[locale]/(admin)/expert-picks/` — Dr.'s Analysis 관리 (YouTube URL → AI 분석 → draft/publish)

### Chat Sidebar (공개 페이지 좌측 고정)
- `src/components/chat/chat-sidebar.tsx` — "Ask Dr.pharmacist" 챗봇. 데스크톱 좌측 340px 고정, 모바일 플로팅 버튼
- `src/app/api/chat/route.ts` — Gemini 스트리밍 + DB 제품 검색 → 응답에 `/analysis/[slug]` 링크 자동 삽입
- 퀵 프롬프트 3개 제공, 대화 리셋 버튼

### API Routes
- `src/app/api/cron/weekly/route.ts` — Vercel Cron (매일 09:00 UTC). 월요일: 수집, 매일: 분석 3개
- `src/app/api/cron/products/route.ts` — Vercel Cron (매일 10:00 UTC). 시드 리스트 20개씩 배치 처리 (FDA+이미지+AI분석+구매링크)
- `src/app/api/click/[linkId]/route.ts` — 구매 클릭 추적 → 302 리다이렉트
- `src/app/api/lookup/image/route.ts` — 이미지 OCR 제품 식별

### Components
- `src/components/layout/header.tsx` — 글로벌 헤더 + 검색바
- `src/components/home/home-search-bar.tsx` — 히어로 검색바
- `src/components/admin/admin-sidebar.tsx` — Admin 사이드바 메뉴

### DB Schema & Migrations
- `src/lib/db/schema.ts` — Drizzle ORM 스키마 (모든 테이블 + enum + 관계)
- `supabase/migrations/001_full_schema.sql` — 초기 DDL
- `supabase/migrations/003_compare_feature.sql` — 비교 + 참고문헌
- `supabase/migrations/005_trends_pipeline.sql` — 트렌드 파이프라인
- `supabase/migrations/006_product_info_management.sql` — 제품 관리 (product_type, approval_status, K-beauty, retailers, purchase_links, click_events)
- `supabase/migrations/007_expert_picks.sql` — Dr.'s Analysis 테이블
- `supabase/migrations/008_trend_image_url.sql` — 트렌드 커버 이미지
- `supabase/migrations/009_expert_picks_features.sql` — Dr.'s Analysis 확장 (clean_transcript, proper_notes, feature_sections — 후자 2개 컬럼은 DB에 있으나 현재 UI 미사용)

---

## TODO (미구현)

### e-Commerce 고도화
- Amazon Associates 계정 → PA-API 연동 (실시간 가격/재고)
- iHerb Impact 제휴 계정 → 딥링크
- 제휴 수수료 추적 (conversions 테이블)
- 리테일러별 실제 API로 샘플 데이터 교체 (`getSampleRetailerProducts()` → 실제 API)

### Phase 2 데이터 소스
- EU CosIng 규제 상태
- FDA MoCRA 화장품 규제
- CIR 성분 안전성 리뷰
- Korean MFDS (K-beauty Phase 2+)

### 기타
- Vercel 배포 (환경변수: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_GENERATIVE_AI_API_KEY, OPENFDA_API_KEY)
- middleware → proxy 경고 수정 (Next.js 16 deprecation)
- Gemini 유료 전환 (무료 티어 일일 한도 해제)

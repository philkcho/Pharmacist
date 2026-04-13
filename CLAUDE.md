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

---

## 프로젝트 아키텍처

### 사용자 흐름

```
홈페이지 (/)
├── 검색바 (히어로 + 헤더 상시)
├── Trending Now — 최신 트렌드 아티클 3개 (카드, 클릭 유도 headline)
│   └── 클릭 → /trending/[slug] 아티클 상세
├── Expert Picks — 전문가 추천 콘텐츠 3개 (TODO: 유튜브 기반)
│   └── 클릭 → /expert/[slug] 상세
└── View All → /trending 인덱스

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
├── Where to Buy (리테일러별)
├── Research & References
└── Sticky Buy Bar (스크롤 따라감)
```

### 데이터 파이프라인

```
Google Trends (주 1회, 월요일)
  → ingestWeeklyTrends() — trend_topics 테이블에 pending 저장
  → analyzeTrend() — Layer 1 (classify) + Layer 2 (retrieve) + Layer 3 (synthesize)
     ├── Health: FDA labels + FAERS + Recalls + PubMed + Recent PubMed (30일)
     ├── Beauty: Open Beauty Facts + PubMed + AAD/DermNet
     └── 성공 시 auto-publish (pharmacist_reviewed=false, amber 배너)
  → matchProducts() — DB에서 approved 제품 매칭 (최대 3개)
  → persistBeautyProducts() — OBF 제품을 draft로 저장 (약사 승인 대기)
  → autoGeneratePurchaseLinks() — 리테일러별 검색 URL 자동 생성
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

### expert_picks (TODO)
유튜브 기반 전문가 추천 콘텐츠. youtubeUrl, transcript, summary, analysisSections, mentionedProducts, status.

---

## 주요 파일 맵

### AI & Analysis
- `src/lib/ai/types.ts` — TopicUnderstanding, SourceFragment, Analysis, ProductMatch, MarketReaction
- `src/lib/ai/classify-topic.ts` — Layer 1: 토픽 분류 + 엔티티 추출
- `src/lib/ai/synthesize-analysis.ts` — Layer 3: Gemini 합성 (answer, leadExplanation, headline, keyTakeaways, redFlags, trendDrivers)
- `src/lib/ai/match-products.ts` — 제품 매칭 (drug name → generic → category, approved만)
- `src/lib/ai/identify-product.ts` — 이미지 OCR (Gemini Vision)

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

### Public Pages
- `src/app/[locale]/(public)/page.tsx` — 홈 (히어로 + 검색 + Trending Now 3개 + Expert Picks TODO)
- `src/app/[locale]/(public)/trending/page.tsx` — 트렌드 인덱스
- `src/app/[locale]/(public)/trending/[slug]/page.tsx` — 트렌드 아티클 상세
- `src/app/[locale]/(public)/topics/[keyword]/page.tsx` — 토픽 (리테일러별 제품 + 분석/구매 버튼)
- `src/app/[locale]/(public)/analysis/[slug]/page.tsx` — 제품 분석 상세 (성분, 장단점, sticky buy bar)
- `src/app/[locale]/(public)/search/page.tsx` — 검색 결과
- `src/app/[locale]/(public)/compare/` — 제품 비교 (카테고리별)

### Admin Pages
- `src/app/[locale]/(admin)/trends/` — 트렌드 관리 (pending/published/rejected)
- `src/app/[locale]/(admin)/approval-queue/` — 약사 승인 큐 (draft → approved/rejected)
- `src/app/[locale]/(admin)/retailers/` — 리테일러 관리 (CRUD, 제휴 정보)
- `src/app/[locale]/(admin)/medications/` — 제품 CRUD
- `src/app/[locale]/(admin)/review-requests/` — 사용자 리뷰 요청 큐
- `src/app/[locale]/(admin)/articles/` — 약사 아티클 관리

### API Routes
- `src/app/api/cron/weekly/route.ts` — Vercel Cron (매일 09:00 UTC). 월요일: 수집, 매일: 분석 3개
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

---

## TODO (미구현)

### Expert Picks (전문가 추천 콘텐츠)
- YouTube URL 입력 → 트랜스크립트 추출 → LLM 1분 요약
- 구조화 분석 섹션 (Basic Content, Analysis, Study & Education 등)
- 영상 속 제품 → 구매 링크 연결
- 홈페이지 "Browse by Category" 자리에 3개 카드 표시
- Admin 생성/편집 페이지
- DB 테이블: `expert_picks`
- 상세 페이지: `/expert/[slug]`

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

# 제품 비교 & 성분 분석 기능 설계서

**상태:** 초안 v5 (2026-04-10) — Product Lookup 기능 추가 (홈 우측 컬럼, 텍스트/이미지 즉시 조회, 섹션 14)
**범위:** 카테고리별 대표 OTC 제품 비교표 + 제품별 상세(성분 분석·장단점·주의사항) + **제품명·사진으로 즉시 조회하는 Product Lookup** 기능. 모든 주장을 공신력 있는 기관 출처에 링크하는 것이 핵심 차별화 — 카테고리에 따라 적절한 권위 기관(의약품은 FDA, 화장품은 AAD/CIR, 보충제는 NIH ODS 등)이 자동으로 우선 적용됨. Lookup은 홈 진입 직후 "와우 모멘트"를 만드는 핵심 기능.

---

## 1. 기능 개요

기존 article(읽을거리) 중심 구조에 **product-centric** 탐색 경로를 추가한다. 사용자는 카테고리 → 대표 제품 비교표 → 개별 제품 상세(성분·장단점·주의사항) → 관련 약사 아티클 순으로 이동한다.

**사용자 가치:** "두통약 뭐 먹지?" 같은 질문에 대해, 아티클을 읽기 전에 **비교표 한 장**으로 후보를 좁히고, 원하는 제품만 깊이 읽게 만든다.

### 브랜드 경험 목표 (Wow Moment)

사용자가 이 사이트에 처음 들어왔을 때 즉시 느껴야 할 3가지:

1. **"와우 이렇구나"** — 복잡한 의약품 정보가 한 장의 비교표로 정리되어 있음. 즉각적인 깨달음
2. **"정말 좋은 비교 자료네"** — 깊이·완성도·일관성이 느껴지는 수준 높은 콘텐츠
3. **"아주 객관적이네"** — **모든 주장에 공신력 있는 기관(FDA, PubMed, CDC, WHO, NIH, Cochrane 등)의 출처가 링크되어 보인다**. 광고가 아님이 명백하고 편향이 없음

세 번째 요소는 본 사이트의 **핵심 차별화**이며, 전체 설계(데이터 모델, UI, 편집 워크플로)의 기반이다.

### 타깃 페르소나 — 일반 소비자 (확정)

**Primary persona:** OTC를 직접 구매하려는 일반 성인 소비자. 약리학 지식은 없고, "뭘 사야 안전하고 효과적인지"를 빠르게 알고 싶어 한다. 동시에 "이 정보를 믿어도 되나?"에 민감하여 **출처의 권위**가 설득력의 결정적 요소이다.

**Non-target (명시적 배제):** PharmD·의사·약대생. 이들은 이 사이트의 2차 사용자일 수 있으나 UI·카피·콘텐츠 우선순위는 소비자에 맞춘다.

**이 결정이 설계에 미치는 영향:**
- 모든 공개 UI는 **평문(plain English) 소비자 언어**로 작성. "COX inhibition" 같은 표현은 기본 뷰에 등장하지 않는다
- 성분 분석 깊이는 **"What it does + Who it's for + When to avoid"** 수준을 기본으로 한다
- 전문가용 상세(약리학·약동학·상호작용 메커니즘)는 데이터 모델에는 보존하되, UI에서는 접힘(`<details>` / "For healthcare professionals" expand)으로만 노출한다
- 카피 톤: 친근하고 직관적. 예: "Works best for mild headaches" (O) vs "First-line analgesic for mild-to-moderate pain" (X)
- **모든 factual claim은 공신력 있는 기관 출처에 inline 링크**된다. 출처 없는 주장은 admin에서 승인 차단

---

## 2. 기존 인프라 재사용 현황

| 대상 | 재사용 | 비고 |
|---|---|---|
| `medications` 테이블 | ✅ 그대로 | name, generic, brands, active_ingredients (jsonb), dosage_forms, warnings, side_effects, category_id, image_url, purchase_links 이미 존재 |
| `categories` (계층형) | ✅ 그대로 | parent_id로 하위 분류 가능 |
| `article_medications` junction | ✅ 활용 | 제품 → 관련 아티클 역참조 |
| Admin `/medications` UI | ⚠️ 확장 | 신규 필드 편집 + AI 생성 버튼 추가 |
| `/api/ai/extract-products` | ♻️ 재활용/확장 | 이미 아티클에서 제품 추출하는 로직 존재 |

---

## 3. 데이터 모델 — 신규 컬럼

`medications` 테이블에 다음 컬럼을 추가한다 (drizzle 마이그레이션):

```ts
// 비교/분석용 필드
pros: jsonb                // Array<{ text: string, sourceIds: number[] }> — 장점 + 출처 참조
cons: jsonb                // Array<{ text: string, sourceIds: number[] }> — 단점 + 출처 참조
verdict: text              // 약사 한줄평
verdictSourceIds: integer[] // verdict를 뒷받침하는 출처 IDs
ingredientAnalysis: jsonb  // 구조화된 성분별 breakdown (아래 참고, 각 필드에 sourceIds 포함)
comparisonScore: integer   // 카테고리 내 점수 (0-100), 정렬 및 랭킹용
scoringRationale: text     // 왜 이 점수인지 약사 노트 (methodology 페이지에서 공개)
isFeatured: boolean        // 카테고리 대표 제품 여부 (홈·비교표 우선 노출)
priceRange: text           // "$10-$15" 같은 가격대 레이블
priceUpdatedAt: timestamp  // 가격 정보 최신성
recommendedFor: text[]     // "Adults", "Mild pain" 등 태그
isAiDrafted: boolean       // AI가 채운 초안인지 (약사 승인 여부 구분용)
reviewedAt: timestamp      // 약사가 최종 검토한 시각 (공개 페이지에 노출)
reviewedBy: uuid           // 검토 약사 (pharmacist_profiles.id FK)
```

### 신규 테이블 `medication_references`

**왜 별도 테이블?** 출처는 여러 필드에서 공유되고(pros·cons·verdict·ingredientAnalysis), 여러 medication이 같은 출처를 참조할 수 있어야 한다(중복 제거). inline JSONB 대신 정규화된 테이블로 관리한다.

```ts
// medication_references
id: bigint (pk, generated)
medicationId: bigint (fk → medications.id, cascade delete)
sourceType: enum [
  // ── Tier 1: Universal (모든 카테고리 공통) ──
  "fda_label",             // FDA Drug Label / DailyMed
  "fda_guidance",          // FDA Guidance Document
  "fda_mocra",             // FDA MoCRA (화장품 규제)
  "pubmed",                // PubMed peer-reviewed study
  "cochrane",              // Cochrane systematic review
  "cdc",                   // CDC recommendation
  "who",                   // WHO guideline
  "nih_ods",               // NIH Office of Dietary Supplements
  "nih_medlineplus",       // NIH MedlinePlus
  "nih_nccih",             // NIH Center for Complementary & Integrative Health
  "ema",                   // European Medicines Agency

  // ── Tier 2: Category-specific (전문 학회·규제 기관) ──

  // 피부과 · 화장품
  "aad",                   // American Academy of Dermatology
  "dermnet_nz",            // DermNet NZ (peer-reviewed dermatology reference)
  "cir",                   // Cosmetic Ingredient Review
  "eu_cosing",             // EU CosIng Database (INCI)
  "skin_cancer_foundation",// Skin Cancer Foundation (sunscreen seal)

  // 보충제 · 비타민
  "usp",                   // US Pharmacopeia
  "nsf",                   // NSF International
  "consumerlab",           // ConsumerLab.com (commercial testing, 조건부)
  "examine",               // Examine.com (evidence-based, 조건부)

  // 구강
  "ada_seal",              // ADA Seal of Acceptance

  // 소아
  "aap",                   // American Academy of Pediatrics
  "healthychildren",       // HealthyChildren.org (AAP consumer site)

  // 안과
  "aao",                   // American Academy of Ophthalmology
  "nih_nei",               // National Eye Institute

  // 소화기
  "aga",                   // American Gastroenterological Association
  "isapp",                 // International Scientific Association for Probiotics and Prebiotics

  // 응급 · 상처
  "red_cross",             // American Red Cross
  "aha",                   // American Heart Association

  // 수면
  "aasm",                  // American Academy of Sleep Medicine

  // ── Tier 3: Conditional (조건부, 단독 인용 금지) ──
  "ewg",                   // EWG Skin Deep (Tier 1이 같은 claim을 뒷받침할 때만 보조 인용)

  "other_authoritative"    // 향후 추가되는 승인된 화이트리스트
]
tierLevel: smallint      // 1 (universal), 2 (category-specific), 3 (conditional)
title: text              // 출처 제목
url: text                // 출처 URL (archive.org 미러 권장)
authors: text            // 저자/기관
publishedAt: date        // 출간 연도/날짜
accessedAt: timestamp    // 약사가 확인한 시각 (신선도 관리)
citationText: text       // "FDA Drug Label for Acetaminophen, 2024" 같은 full citation
sortOrder: integer       // 제품 페이지의 References 섹션 정렬
```

**허용 출처 화이트리스트 규칙:**
- 위 `sourceType` 외의 출처(블로그, 제조사 광고, Wikipedia, 리테일러 페이지 등)는 DB 레벨에서 거부
- Admin UI에서도 선택 불가
- **Tier 3 (ewg 등)은 단독 인용 금지** — 같은 claim을 뒷받침하는 Tier 1 또는 Tier 2 출처가 1개 이상 동시에 존재해야 저장 허용

### 카테고리 → 출처 우선순위 매핑

카테고리별로 가장 권위 있는 출처가 다르다. Admin UI와 AI 프롬프트는 아래 매핑을 참고해 해당 카테고리에 맞는 출처를 우선 제안한다.

```ts
// src/lib/references/category-source-map.ts
export const CATEGORY_SOURCE_PRIORITY: Record<string, SourceType[]> = {
  // 의약품 — Tier 1 중심
  "pain-relief":        ["fda_label", "pubmed", "cochrane", "cdc", "aha"],
  "cold-flu":           ["fda_label", "cdc", "pubmed", "cochrane", "who"],
  "allergy":            ["fda_label", "aad", "pubmed", "cochrane"],

  // 화장품 · 스킨케어 — Tier 2 피부과 기관 우선
  "skin-care-beauty":   ["aad", "cir", "dermnet_nz", "pubmed", "eu_cosing", "fda_mocra", "skin_cancer_foundation"],

  // 보충제 — NIH ODS가 최우선
  "vitamins-supplements": ["nih_ods", "pubmed", "cochrane", "usp", "nsf", "examine"],

  // 소화기 — 의약품이면 FDA, 프로바이오틱스면 NIH/ISAPP
  "digestive-health":   ["fda_label", "aga", "nih_ods", "isapp", "pubmed"],

  // 구강 — ADA Seal이 gold standard
  "oral-care":          ["ada_seal", "pubmed", "aad", "fda_label"],

  // 수면 — AASM과 NIH NCCIH
  "sleep-relaxation":   ["aasm", "nih_nccih", "pubmed", "cochrane"],

  // 응급 · 상처
  "first-aid":          ["red_cross", "aha", "aad", "fda_label", "pubmed"],

  // 안과 (향후 추가될 경우)
  "eye-care":           ["aao", "nih_nei", "pubmed", "fda_label"],

  // 소아 (향후 추가될 경우)
  "baby-care":          ["aap", "healthychildren", "cdc", "fda_label"],
}
```

**AI 프롬프트 통합:** `generate-medication-analysis` 호출 시 medication의 `category.slug`를 읽어 위 배열을 system 프롬프트에 주입한다:

```
This product belongs to the "${category}" category.
For this category, prioritize sources from these authorities (in order):
${CATEGORY_SOURCE_PRIORITY[category].join(" → ")}
Only cite sources from this list or from Tier 1 universal sources.
```

**재사용 가능성:** 기존 `/api/ai/extract-references` 라우트가 PubMed/FDA/CDC/WHO 우선순위 구조로 되어 있음. 이것을 위 카테고리별 매핑을 주입하는 형태로 일반화하여 medication 레벨 출처 자동 제안에 재활용한다.

### 기존 `medications` 필드의 확장

- `purchase_links` 에 `isAffiliate: boolean`, `disclosure: text` 필드 추가 — FTC 공시 의무 대응
- `viewCount`, `lastReviewedAt` 컬럼 추가 (lastReviewedAt는 reviewedAt과 동일하게 해도 됨)

### `ingredientAnalysis` JSONB 구조 — 소비자 우선 + 전문가 확장

**설계 원칙:** 데이터 모델은 두 레이어로 나눈다.
- **`consumer`** — 기본 UI에 항상 표시. 평문, 소비자 언어
- **`professional`** — `<details>` 확장에서만 표시. 약리학·약동학·상호작용 깊이

**모든 서술 필드에 `sourceIds` 배열이 붙는다.** `sourceIds`는 `medication_references.id`를 참조하며, UI에서 superscript 숫자([1], [2])로 렌더된다.

```json
[
  {
    "name": "Acetaminophen",
    "amount": "500mg",

    "consumer": {
      "whatItDoes": {
        "text": "Relieves mild to moderate pain and reduces fever.",
        "sourceIds": [1, 3]
      },
      "howFast": {
        "text": "Starts working in about 30-60 minutes.",
        "sourceIds": [1]
      },
      "whoItsFor": {
        "text": "Most adults and children. A good first choice if you have a sensitive stomach or take blood thinners.",
        "sourceIds": [1, 5]
      },
      "whenToAvoid": [
        { "text": "If you drink alcohol heavily", "sourceIds": [1, 7] },
        { "text": "If you have liver disease", "sourceIds": [1] },
        { "text": "If you're already taking another product with acetaminophen", "sourceIds": [1] }
      ],
      "maxPerDay": {
        "text": "Don't exceed 4,000 mg (8 regular-strength tablets) in 24 hours.",
        "sourceIds": [1]
      }
    },

    "professional": {
      "role": "Analgesic / Antipyretic",
      "mechanism": { "text": "Central COX inhibition; reduces prostaglandin synthesis in CNS.", "sourceIds": [2, 4] },
      "pharmacokinetics": {
        "onset": "30-60 min",
        "peak": "1-2 hr",
        "halfLife": "2-3 hr",
        "metabolism": "Hepatic (glucuronidation, sulfation)",
        "sourceIds": [1]
      },
      "clinicalNotes": { "text": "Preferred first-line for mild-to-moderate pain in patients with GI or bleeding risk.", "sourceIds": [4, 6] },
      "interactions": [
        { "with": "Warfarin", "severity": "moderate", "note": "May increase INR with chronic use >2g/day", "sourceIds": [8] },
        { "with": "Alcohol", "severity": "high", "note": "Hepatotoxicity risk", "sourceIds": [1, 7] }
      ],
      "contraindications": ["Severe hepatic impairment", "Acetaminophen allergy"],
      "maxDailyDose": { "text": "4g (healthy adults), 3g (chronic alcohol use)", "sourceIds": [1] }
    }
  }
]
```

**UI 렌더링 규칙:**
- 기본(default) 뷰: `consumer` 필드만 표시
- **모든 claim 옆에 superscript 번호 ([1])** — 클릭하면 페이지 하단 References 섹션으로 스크롤
- References 섹션은 공개 페이지 하단에 항상 노출 (footnote 스타일이 아니라 **풍부한 카드 형태**: 제목, 저자/기관, 출판일, URL, 로고)
- "For healthcare professionals" 접힘 영역: `professional` 필드 표시
- 전문가 영역 상단에 disclaimer: *"The following section is intended for healthcare professionals."*
- 소비자 영역은 SEO 인덱싱 대상, 전문가 영역은 `noindex` 메타 고려 (선택)
- **`sourceIds`가 빈 claim은 공개 불가**. Admin에서 "Missing sources" 경고 배너 표시

---

## 4. 라우트 구조

### 신규 public 라우트
```
/en/compare                                    — 카테고리 허브
/en/compare/[category-slug]                    — 카테고리별 제품 비교표
/en/compare/[category-slug]/[medication-slug]  — 개별 제품 상세
```

### 기존 admin 라우트 (확장)
```
/en/medications       — 신규 필드 편집 UI, AI 생성 버튼, featured 관리
```

`/compare`를 선택한 이유: admin의 `/medications`와 URL 충돌을 피하고 의도(비교)를 드러냄.

---

## 5. 홈 레이아웃 변경

Hero는 full-width 유지. Hero 아래를 2-column으로 변경. **우측 컬럼 상단에는 Product Lookup 도구(섹션 14), 그 아래에 Latest Articles**가 공존한다.

### 5.1 데스크탑 레이아웃

```
┌──────────────────────────────────────────────────┐
│                      Hero                        │
│                  (full-width)                    │
├──────────┬───────────────────────────────────────┤
│          │  🔍 Look up any OTC product           │
│ Compare  │  ┌─────────────────────────────────┐  │
│    by    │  │ [Search by name]                │  │
│ Category │  │  or                             │  │
│          │  │ [📷 Upload photo (Phase 2)]     │  │
│  • Pain  │  └─────────────────────────────────┘  │
│  • Cold  │  Popular lookups:                     │
│  • Vita. │  • Tylenol · Zyrtec · Vitamin D3      │
│  • ...   │                                       │
│ [View    │  ─────────────────────────────────    │
│  All →]  │                                       │
│          │   Latest Articles                     │
│          │   (3-up grid)                         │
│          │   [More Articles →]                   │
├──────────┴───────────────────────────────────────┤
│                Browse by Category                │
├──────────────────────────────────────────────────┤
│                    Features                      │
└──────────────────────────────────────────────────┘
```

- **비율:** `lg:grid-cols-[240px_1fr]`
- **좌측 (Compare by Category):**
  - 제목: `Compare Products`
  - 카테고리 리스트 (emoji + 이름 + arrow icon)
  - 각 항목 → `/compare/[category-slug]`
  - 하단 `View all →` → `/compare`
- **우측 상단 (Product Lookup):** 섹션 14 참조
- **우측 하단 (Latest Articles):** 기존 3-up grid, 좌측 영역 고려해 `md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3`로 조정

### 5.2 모바일 레이아웃 (중요)

**모바일에서는 Product Lookup을 Hero 바로 아래로 승격**한다. 건강 검색 트래픽의 대부분이 모바일이고, Lookup이 본 사이트의 핵심 "wow" 경험이기 때문에 첫 스크롤 안에 반드시 보여야 한다.

```
┌──────────────────────────┐
│         Hero             │
├──────────────────────────┤
│  🔍 Product Lookup       │  ← 모바일에서 승격
│  (full-width input)      │
├──────────────────────────┤
│  Compare by Category     │  ← horizontal scroll chips
│  [Pain][Cold][Vita][...] │
├──────────────────────────┤
│  Latest Articles         │
│  (1열 stack)             │
├──────────────────────────┤
│  Browse by Category      │
├──────────────────────────┤
│  Features                │
└──────────────────────────┘
```

- 모바일 Compare by Category는 `ScrollArea`를 이용한 horizontal scroll chip 리스트로 변경 (마케팅 리뷰에서 지적된 모바일 2-column 문제 해결)

---

## 6. 페이지 구조

### 6.1 `/compare` (허브)

1. 페이지 타이틀: "Compare OTC Products"
2. 설명: "Side-by-side comparisons of pharmacist-reviewed over-the-counter medications."
3. **카테고리 카드 그리드** — 카테고리별 대표 제품 썸네일 3개 미리보기
4. **Editor's Picks 섹션** — 전체에서 `isFeatured = true` + `comparisonScore` 상위 제품

### 6.2 `/compare/[category-slug]` (카테고리 비교)

**카피 톤:** 소비자 친화. "Top picks for [headache]" 같은 직관적 표현.

1. **카테고리 hero** — 평문 description ("Everything you need to know about pain relievers you can buy without a prescription")
2. **Comparison Table** — `isFeatured = true`인 제품 가로 비교
   - 열: 제품 이미지/이름, **"Best for"** (예: "Mild headaches"), 가격대, ★평점, **"Works in"** (예: "30 min")
   - 전문 용어 금지 — "Active ingredient 500mg acetaminophen" (X) → "Contains acetaminophen (the same as Tylenol)" (O)
   - 모바일: 카드형 세로 스택
3. **전체 제품 리스트** — 카테고리 내 모든 medications (`comparisonScore desc`)
4. **"Which one is right for me?" 가이드** — 상황별 추천 (예: "Have a sensitive stomach? → Tylenol", "Need it to last longer? → Aleve"). `recommendedFor` 태그와 `cons`를 조합해 생성
5. **관련 약사 아티클** — `articles` 중 카테고리 일치, `status = published` 상위 3개

### 6.3 `/compare/[category-slug]/[medication-slug]` (제품 상세)

**렌더링 규칙:** 모든 섹션은 소비자 언어 기본. 전문가용 세부 정보는 섹션 5의 접힘 영역에만 등장. **모든 factual claim 옆에 superscript 번호 [1][2]가 붙고, 클릭 시 하단 References 섹션으로 스크롤한다.**

1. **Product hero** — 이미지, 이름, brand/generic, 가격대, 별점 배지
   - 바로 아래 **Trust bar:** "Last reviewed by [Dr. Name, PharmD] on [2026-04-10] · Sources: FDA, PubMed, CDC"
2. **At a Glance** — 3-4개 bullet (예: "Works in 30 min [1]", "Lasts 4-6 hours [1]", "Safe for most adults [2]", "Gentle on the stomach [3]")
3. **Pharmacist's Take** — `verdict` 필드를 큰 인용문 스타일. 1-2 문장 친근한 톤. 인용 끝에 superscript 출처
4. **Pros / Cons** — 2열 대비 리스트. 각 항목은 "What's great" / "What to watch out for" 같은 친근한 헤딩. **각 pro/con 옆에 superscript 번호**
5. **How It Works** — `ingredientAnalysis[].consumer` 필드를 카드로 렌더
   - **기본:** `whatItDoes`, `howFast`, `whoItsFor`, `whenToAvoid`, `maxPerDay` — 각 claim에 superscript
   - **접힘 섹션:** `<details><summary>For healthcare professionals</summary>` 안에 `professional` 필드 전체 (mechanism, pharmacokinetics, interactions, contraindications) — 동일하게 superscript
   - 전문가 영역은 의료 전문가 대상 disclaimer 동반
6. **Safety Info** — `warnings` + `side_effects`, 빨간 강조 박스. "When to stop and see a doctor" CTA
7. **Where to Buy** — `purchase_links` (affiliate 명시). 비즈니스 모델 결정 후 위치 재조정 가능
8. **References** — **본 페이지의 핵심 차별화 섹션.** 풍부한 카드 형태로 모든 출처 리스팅:
   - 각 카드: 출처 타입 배지 (FDA / PubMed / CDC / WHO / NIH / Cochrane / AAD / CIR / NIH ODS / ADA Seal 등 카테고리에 맞는 Tier 2 기관 로고 포함), 제목, 저자/기관, 출간일, 외부 링크 아이콘
   - Tier별 색상·아이콘 구분 (Tier 1: 정부/규제 파랑, Tier 2: 전문학회 보라, Tier 3 EWG 같은 보조: 회색)
   - 본문 claim의 [1]을 클릭하면 해당 카드로 스크롤 + 하이라이트
   - 섹션 상단 문구: *"Everything on this page is based on information from authoritative sources — FDA, PubMed, ${category-specific institutions}. Here's where each claim comes from."*
   - "Last fact-checked on [date]" 표시
   - "See our methodology" 링크 → `/methodology`
9. **Related Guides** — `article_medications` junction으로 해당 제품이 언급된 아티클

---

## 7. Admin 기능 확장 (`/medications`)

기존 medications 편집 폼에 추가:

- **AI 자동 생성 버튼** — 기본 정보(name, generic, ingredients, description)를 입력으로 Gemini가 초안 생성:
  - pros / cons / verdict (각 항목에 sourceIds 후보 제안)
  - ingredientAnalysis — 소비자 + 전문가 두 레이어 동시
  - **references 후보** — medication의 category에 따라 `CATEGORY_SOURCE_PRIORITY` 매핑을 참조하여 적절한 Tier 2 기관(피부과는 AAD/CIR, 보충제는 NIH ODS, 구강은 ADA Seal 등)을 우선 제안
  - recommendedFor 태그 제안
- **References 관리 패널** (신규):
  - `medication_references` 테이블의 출처를 편집·추가·삭제
  - **카테고리 인식 출처 피커** — medication의 카테고리를 읽어 `CATEGORY_SOURCE_PRIORITY[category]`에 해당하는 sourceType을 상단에 highlight 표시
  - 각 출처의 `sourceType` 드롭다운 (화이트리스트에서만 선택, Tier별로 그룹화 표시)
  - 출처 URL 자동 메타데이터 fetch (제목·저자·출간일)
  - 각 출처 옆에 "이 출처를 참조하는 필드" 리스트 표시
  - **Tier 3 (EWG 등) 선택 시 경고 배너:** "This source can only be used if a Tier 1 source (FDA, PubMed) supports the same claim. Please add a primary source first."
- **Claim ↔ Source 매핑 UI:**
  - pros/cons/verdict/ingredientAnalysis의 각 claim을 편집할 때 출처 선택 드롭다운 표시
  - **최소 1개 출처가 없는 claim은 저장 불가 (소프트 경고) / 승인 불가 (하드 차단)**
  - **Tier 3 출처만 있는 claim도 승인 불가** (반드시 Tier 1 또는 Tier 2가 동반되어야 함)
- 약사가 초안을 편집 후 **"Approve & Publish"** → `isAiDrafted = false`, `reviewedBy/reviewedAt` 기록
  - **승인 체크리스트 (모두 통과해야 버튼 활성):**
    - [ ] 모든 pros/cons에 sourceIds ≥ 1 (Tier 1 또는 Tier 2 포함)
    - [ ] verdict에 verdictSourceIds ≥ 1
    - [ ] ingredientAnalysis의 모든 소비자·전문가 필드에 sourceIds ≥ 1
    - [ ] 최소 3개 이상의 고유 references 등록
    - [ ] 모든 출처가 화이트리스트 sourceType에 속함
    - [ ] 해당 카테고리의 권장 sourceType 중 최소 1개 포함 (예: 화장품이면 AAD/CIR/DermNet 중 하나 이상)
    - [ ] Tier 3 출처가 있다면 같은 claim을 뒷받침하는 Tier 1/2 출처도 동반됨
    - [ ] scoringRationale 작성됨
- **Featured 토글 + comparisonScore 슬라이더 (0-100) + scoringRationale 텍스트**
- pros/cons는 태그형 입력 UI (shadcn/ui + custom)
- ingredientAnalysis는 JSONB 편집기(섹션별 폼, raw JSON 모드 토글)
- 카테고리 내 정렬: 드래그앤드롭으로 comparisonScore 일괄 조정

### 신규 API 라우트

```
POST /api/ai/generate-medication-analysis
  body: { medicationId }
  → Gemini로 pros/cons/verdict/ingredientAnalysis + references 후보 초안 생성 → DB 업데이트

POST /api/ai/suggest-medication-references
  body: { medicationId, claim: string }
  → 특정 claim에 대한 추가 출처 후보 (FDA/PubMed/CDC 우선) 제안

POST /api/references/fetch-metadata
  body: { url }
  → URL에서 제목·저자·출간일 자동 추출 (출처 등록 편의)
```

기존 `extract-products`와 분리하는 이유: 전자는 아티클 본문에서 제품을 **추출**하고, 신규 라우트는 이미 등록된 medication에 대해 **출처 기반 심층 분석**을 생성한다.

기존 `extract-references` 라우트(이미 PubMed·FDA·CDC·WHO 우선순위 구조)는 본 기능의 references 자동 생성에 **재활용**한다.

---

## 8. 구현 단계

| Phase | 내용 | 산출물 | 블로커 |
|---|---|---|---|
| **1** | Drizzle 마이그레이션: medications 신규 컬럼 추가 | `supabase/migrations/xxxx.sql` | 기존 데이터 호환 (모두 nullable로 추가) |
| **2** | 서버 액션: `getMedicationsByCategory`, `getFeaturedMedications`, `getMedicationBySlug` 등 | `src/lib/actions/medications.ts` | — |
| **3** | `/compare/[category-slug]` 페이지 + Comparison Table UI | — | shadcn Table 컴포넌트 |
| **4** | `/compare/[category-slug]/[medication-slug]` 상세 페이지 | — | — |
| **5** | `/compare` 허브 페이지 | — | — |
| **6** | 홈 2-column 레이아웃 + Compare 좌측 블록 | 홈 개편 | 기존 페이지 수정 |
| **7** | Admin medications 폼 신규 필드 편집 UI | — | JSONB 편집기 |
| **8** | `/api/ai/generate-medication-analysis` + admin 버튼 연동 | — | Gemini 프롬프트 설계 (전문가 수준 출력 검증) |
| **9** | 약사 검토 워크플로 (승인/반려 버튼, isAiDrafted 필터링) | — | — |

**Phase 1~5**가 핵심 MVP. **Phase 6~9**는 운영 편의·AI 자동화.

---

## 9. AI 생성 워크플로 (결정사항)

- **기본 원칙:** AI가 출처와 함께 초안을 생성, 약사가 출처를 검증·보강하고 승인
- **AI 모델:** `gemini-2.5-flash` (기존 라우트와 통일, 무료 티어 작동)
- **maxRetries: 0** (기존 라우트와 동일한 쿼터 보호 정책)
- **검토 전 상태:** `isAiDrafted = true`, **공개 페이지에 노출되지 않음** (마케팅 리뷰 권고 반영 — AI draft는 절대 비공개)
- **승인 후:** `isAiDrafted = false`, `reviewedAt` + `reviewedBy` 기록, 공개 노출
- **공개 페이지 필터링:** `isAiDrafted = false AND reviewedAt IS NOT NULL` 조건만 노출
- **AI 출처 생성의 한계:** Gemini는 그럴듯하지만 실존하지 않는 URL을 만들 수 있음. **모든 AI 제안 출처는 약사가 클릭해 실존 여부와 관련성을 확인해야 승인 가능.** Admin UI에 출처별 "검증 완료" 체크박스 추가

### Gemini 프롬프트 설계 방향 — 소비자 우선 + 전문가 부록 + 출처 필수

**한 번의 호출로 생성:** 분석 + 출처 후보 + claim-to-source 매핑.

```
system: You are a licensed pharmacist (PharmD) writing for two audiences:
(1) everyday consumers with no medical background — your PRIMARY audience, and
(2) healthcare professionals who may want deeper detail.

CRITICAL — sourcing policy:
- Every factual claim must be supported by an authoritative source.
- This product is in the "${category.slug}" category. For this category,
  prioritize sources from these authorities IN ORDER:
    ${CATEGORY_SOURCE_PRIORITY[category.slug].join(" → ")}
- You may ALSO cite Tier 1 universal sources (FDA, PubMed, Cochrane, CDC,
  WHO, NIH) for any category.
- For DRUG products (pain, cold, allergy, etc.): FDA drug labels on DailyMed
  are the top priority.
- For COSMETIC / SKINCARE products: prioritize AAD, CIR, DermNet NZ, EU CosIng,
  and PubMed dermatology studies. FDA MoCRA regulations apply to cosmetic safety.
- For SUPPLEMENTS / VITAMINS: NIH Office of Dietary Supplements (ODS) is the
  top priority, followed by PubMed, Cochrane, USP, and NSF quality certifications.
- For ORAL CARE: ADA Seal of Acceptance is the gold standard.
- For SLEEP products: AASM and NIH NCCIH.

PROHIBITED sources:
- Manufacturer marketing, product blogs, Wikipedia
- Retailer pages (Amazon, Walgreens, etc.)
- Commercial health content mills (Healthline, WebMD, Medical News Today)
  — these are secondary aggregators, not primary evidence
- Sponsored content of any kind

CONDITIONAL sources:
- EWG Skin Deep may be cited ONLY when a Tier 1 source (FDA, PubMed)
  independently supports the same claim. Never cite EWG alone.
- ConsumerLab and Examine.com are commercial but evidence-based; treat as
  supporting sources alongside primary research.

URL policy:
- Provide REAL URLs where possible
- If unsure of a specific study ID, use a general topic page of the
  authoritative institution rather than guessing
- Do NOT fabricate DOIs, PubMed IDs, or FDA document numbers — a pharmacist
  will verify every link and fabrications will cause rejection

- Every claim returned must reference at least one source via sourceIndex
  (index into the `references` array below).

For consumer sections:
- Plain, friendly English at roughly an 8th-grade reading level
- No jargon. "Stomach problems" not "GI adverse events".
- Frame as "What does it do?", "How fast?", "Who should avoid it?"

For professional sections:
- Standard clinical terminology
- Mechanism, pharmacokinetics, interactions, contraindications
- Assume PharmD-level reader

All output will be reviewed by a licensed pharmacist before publication.
Do not fabricate studies, DOIs, or PubMed IDs. A pharmacist will verify every link.

output schema (zod):
  references: Array<{
    sourceType: "fda_label" | "fda_guidance" | "pubmed" | "cochrane" | "cdc" | "who" | "nih" | "ema" | "other_authoritative",
    title: string,
    url: string,
    authors: string,        // institution if no author
    publishedAt: string,    // "YYYY" or "YYYY-MM"
    citationText: string    // full citation, e.g. "FDA Drug Label for Acetaminophen, 2024"
  }> // 3-8 references total

  // All claim fields below reference sources by index (0-based) into `references`
  pros: Array<{ text: string, sourceIndexes: number[] }>  // 3-5 items
  cons: Array<{ text: string, sourceIndexes: number[] }>  // 2-4 items
  verdict: { text: string, sourceIndexes: number[] }      // 1-2 friendly sentences
  recommendedFor: string[]                                // consumer-facing tags
  ingredientAnalysis: Array<{
    name: string,
    amount: string,
    consumer: {
      whatItDoes: { text: string, sourceIndexes: number[] },
      howFast: { text: string, sourceIndexes: number[] },
      whoItsFor: { text: string, sourceIndexes: number[] },
      whenToAvoid: Array<{ text: string, sourceIndexes: number[] }>,
      maxPerDay: { text: string, sourceIndexes: number[] }
    },
    professional: {
      role: string,
      mechanism: { text: string, sourceIndexes: number[] },
      pharmacokinetics: {
        onset: string, peak: string, halfLife: string, metabolism: string,
        sourceIndexes: number[]
      },
      clinicalNotes: { text: string, sourceIndexes: number[] },
      interactions: Array<{
        with: string, severity: "low"|"moderate"|"high",
        note: string, sourceIndexes: number[]
      }>,
      contraindications: string[],
      maxDailyDose: { text: string, sourceIndexes: number[] }
    }
  }>
```

**서버 후처리:** AI 응답의 `references`를 `medication_references` 테이블에 삽입하고, 각 claim의 `sourceIndexes`를 해당 레코드 ID로 매핑해 저장.

**검증 체크리스트 (약사 검토 UI에 표시):**
- [ ] `consumer` 필드에 약리학 용어가 섞여있지 않은가
- [ ] `pros/cons`가 소비자가 실제로 할만한 표현인가
- [ ] `verdict`가 친근하고 1-2문장인가
- [ ] `professional` 섹션의 사실관계는 정확한가
- [ ] **모든 출처 URL을 클릭해 실존 및 관련성을 확인했는가** (출처별 체크박스)
- [ ] **모든 출처가 화이트리스트 sourceType에 속하는가**
- [ ] **모든 claim에 최소 1개 출처가 매핑되어 있는가**
- [ ] 허위 연구/DOI/PubMed ID가 포함되지 않았는가 (AI hallucination 방지)

---

## 10. 결정된 사항 (요약)

| 결정 항목 | 선택 | 결정 시점 |
|---|---|---|
| **브랜드 포지셔닝** | **객관성·독립성** — "모든 주장을 공신력 있는 기관 출처에 링크" | v3 |
| **핵심 차별화** | 모든 factual claim inline 출처 표시 (FDA, PubMed, CDC, WHO, NIH, Cochrane 등) | v3 |
| **타깃 페르소나** | **일반 소비자** (primary). 전문가는 2차 사용자 | v2 |
| **데이터 입력 방식** | **AI가 출처 후보 포함 초안 생성 → 약사가 출처 검증·승인** | v3 (강화) |
| **성분 분석 깊이** | 2-레이어: 소비자(기본) + 전문가(접힘). 모두 출처 필수 | v2 |
| **출처 화이트리스트** | **3-Tier 구조**: Tier 1 universal (FDA/PubMed/Cochrane/CDC/WHO/NIH/EMA) + Tier 2 category-specific (AAD·CIR·NIH ODS·ADA Seal·AASM 등) + Tier 3 conditional (EWG) | v4 (확장) |
| **카테고리별 출처 매핑** | `CATEGORY_SOURCE_PRIORITY` 상수로 카테고리 → 권장 sourceType 배열 매핑. AI·admin·methodology 페이지가 공유 | v4 |
| **Product Lookup 기능** | 홈 우측 상단에 텍스트/이미지 조회 도구. DB hit → Compare 페이지, DB miss → 경고 배지 포함 AI 분석 + 리뷰 요청 큐 | v5 |
| **Lookup Phase 순서** | Phase 1 텍스트, Phase 2 이미지 (multimodal Gemini) | v5 |
| **Lookup 홈 배치** | 데스크탑: 우측 상단 + Latest Articles 하단 공존 / 모바일: Hero 바로 아래로 승격 | v5 |
| **Lookup AI 결과 정책** | 경고 배지·구분된 UI·noindex로 pharmacist-reviewed와 절대 구분. 사용자는 "Request pharmacist review"로 리드 수집 | v5 |
| **모바일 Compare by Category** | horizontal scroll chip 리스트 (마케팅 리뷰 #6 반영) | v5 |
| **AI draft 공개 여부** | **절대 비공개.** 약사 승인 전까지 노출하지 않음 | v3 (강화) |
| **홈 2-column 노출** | 모든 사이즈 — 마케팅 리뷰에서 모바일 UX 재검토 권고됨 | v1 |
| **설계서 저장** | `docs/compare-feature.md` (본 파일) | v1 |

---

## 11. 아직 열린 질문

다음 항목은 구현 전 추가 결정이 필요하다:

1. **공개 URL 최종 확정** — `/compare` 유지? 혹은 `/otc`, `/medications` 고려?
2. **비즈니스 모델 확정** — affiliate / 광고 / 구독 / 리드 중 하나. 객관성 포지션과 affiliate는 공존 가능하되 FTC 공시 필수
3. **구매 링크 정책** — `purchase_links`에 affiliate 파트너 연동 여부, 순위는 affiliate와 무관함을 methodology 페이지에서 명시
4. **제품 이미지 호스팅** — 외부 URL 저장 vs Supabase Storage 업로드 (라이선스 이슈)
5. **comparisonScore 산정 주체** — 약사 수동 / AI 초안 + 약사 조정 / 규칙 기반(알고리즘 공개)? **methodology 공개가 필수이므로 블랙박스 AI 점수는 부적합**
6. **i18n** — 성분 분석 번역 전략
7. **감사 이력** — medications 수정 이력 audit 테이블
8. **모바일 레이아웃 재검토** — 2-column을 유지할지, horizontal scroll chip으로 변경할지
9. **SEO X-vs-Y 프로그래매틱 페이지** — Phase 5 이후 도입 여부

---

## 12. 브랜드 포지셔닝 & 보이스

### 12.1 포지셔닝 선언문 (1줄)

> **"The independent OTC comparison site. Every claim linked to FDA, PubMed, and other authoritative sources — reviewed by real pharmacists, not paid rankings."**

이 문장은 홈 hero, About 페이지, meta description, OG card 등에 일관되게 등장한다.

### 12.2 태그라인 후보 (A/B 테스트 가능)

- "OTC comparisons you can actually trust."
- "Dr.pharmacist — source-linked, ad-free rankings."
- "No paid rankings. Just sources."
- "Every claim, sourced to FDA and PubMed."

### 12.3 보이스 & 톤 규칙

**권장 표현:**
- "According to the FDA drug label…"
- "A 2022 Cochrane review found…"
- "Gentle on the stomach for most adults."
- "Best first choice if you have…"
- "Here's what the evidence says."

**금지 표현:**
- "BEST!", "#1!", "AMAZING!" — 클릭베이트 과장
- "Doctors recommend…" (구체적 출처 없이 쓰지 않음)
- "Miracle", "cure", "instant relief" — 의료 과장 클레임
- "Sponsored pick", "Partner choice" — affiliate가 있다면 별도 공시 섹션에 표시하고 본문 순위에는 영향 없음
- "In our expert opinion" (근거 없는 주장 대체용으로 쓰지 않음)

**문장 규칙:**
- factual claim 뒤에는 반드시 superscript 출처 번호
- 출처가 없는 주장은 "In general," 같은 hedge 없이 삭제
- 약사 개인 의견은 `verdict` 필드에만 허용하고 "[Dr. Name's take]"로 구분

### 12.4 비주얼 아이덴티티 방향

- 색상: 과도한 브랜드 색 지양. 의료/정부 기관 느낌의 절제된 팔레트 (현재 primary 유지)
- 출처 배지: FDA, PubMed, CDC 등 기관별 로고/색상을 활용한 고유 뱃지 (라이선스 준수 범위 내)
- 타이포그래피: 본문 가독성 최우선. 인용·출처는 작지만 명확히 구분
- 아이콘: lucide-react 중립적 세트 계속 사용

---

## 13. Editorial & Methodology (공개 정책)

**공개 URL:** `/methodology` (푸터 및 모든 compare 페이지 상단에서 링크)

이 페이지는 사이트 신뢰도의 백본이다. **어떻게 만드는지 숨길 것이 없다**는 선언.

### 13.1 구성 (실제 공개 페이지 섹션)

1. **Our Mission** — 왜 이 사이트를 만들었는가. 독립성 선언
2. **How We Select Products** — 각 카테고리에서 어떤 제품을 포함/제외하는 기준
3. **How We Score** — `comparisonScore` 산정 방식 공개 (예: 안전성 40% + 효과 30% + 접근성 20% + 가격 10%)
4. **Our Sources** — **본 섹션이 가장 길고 상세하다.** 아래 13.2 참조
5. **Who Reviews Our Content** — 리뷰 약사 목록·크레덴셜·라이선스 번호
6. **Review Cadence** — 제품 재리뷰 주기, "6개월 이상 미업데이트" 표시 정책
7. **Conflict of Interest** — affiliate / 광고 유무와 그것이 순위에 영향을 주지 않는 방식 설명
8. **Corrections Policy** — 틀린 정보가 있을 때 신고 방법(`corrections@[domain]`)과 처리 절차
9. **Medical Disclaimer** — "본 사이트는 의료 조언을 대체하지 않음" 법적 문구
10. **Contact** — 질문·피드백 경로

### 13.2 "Our Sources" 섹션 — 공개할 Tier 구조

**Tier 1 — Universal primary sources (모든 제품에 적용)**

> "Every product on this site is backed by at least one source from this tier. These are the institutions we consider the highest authority for evidence-based OTC information."

- 🇺🇸 **FDA** — Drug labels (DailyMed), guidance documents, MoCRA cosmetic safety
- 📚 **PubMed (NLM)** — peer-reviewed biomedical research
- 📖 **Cochrane Library** — systematic reviews of clinical evidence
- 🏛️ **CDC** — US Centers for Disease Control and Prevention
- 🌍 **WHO** — World Health Organization guidelines
- 🧪 **NIH Office of Dietary Supplements (ODS)** — supplement fact sheets
- 📘 **NIH MedlinePlus** — consumer health information
- 🌿 **NIH NCCIH** — complementary and integrative health research
- 🇪🇺 **EMA** — European Medicines Agency

**Tier 2 — Category-specific expert authorities**

> "For specific product categories, we also rely on professional medical societies and category-specific regulators whose expertise is the gold standard in their field."

| 카테고리 | 권위 기관 |
|---|---|
| 💊 Pain / Cold / Allergy / Rx | FDA Drug Label + PubMed + Cochrane만으로 충분 |
| ✨ Skincare & Cosmetics | **AAD** (American Academy of Dermatology), **CIR** (Cosmetic Ingredient Review), **DermNet NZ**, **EU CosIng Database**, **Skin Cancer Foundation** |
| 🍊 Vitamins & Supplements | **NIH ODS** (top priority), **USP**, **NSF International**, **ConsumerLab**, **Examine.com** |
| 🦷 Oral Care | **ADA Seal of Acceptance** (gold standard) |
| 🫁 Digestive Health | **AGA** (American Gastroenterological Association), **ISAPP** (for probiotics) |
| 👶 Baby & Children | **AAP** (American Academy of Pediatrics), **HealthyChildren.org** |
| 👁️ Eye Care | **AAO** (American Academy of Ophthalmology), **NEI** (National Eye Institute) |
| 🩹 First Aid | **American Red Cross**, **American Heart Association** |
| 😴 Sleep | **AASM** (American Academy of Sleep Medicine), **NIH NCCIH** |

**Tier 3 — Conditional sources (단독 인용 금지)**

> "These sources are well-known but have limitations. We allow them only when a Tier 1 source independently supports the same claim."

- ⚠️ **EWG Skin Deep Database** — 화장품 성분 검색에 유명하지만 일부 평가가 알려진 과학적 합의보다 과도하게 보수적. Tier 1 출처가 동일 claim을 뒷받침할 때만 보조 인용.

**Prohibited sources (절대 인용하지 않음)**

- ❌ 제조사 마케팅·광고
- ❌ 블로그·뉴스 기사 (Healthline, WebMD, Medical News Today 등 — 이들은 1차 출처가 아닌 2차 수집체)
- ❌ Wikipedia
- ❌ 리테일러 페이지 (Amazon, Walgreens, CVS 등)
- ❌ 스폰서드 컨텐츠·협찬
- ❌ 개인 SNS·인플루언서 콘텐츠

이 정책은 **코드와 DB 레벨에서 강제**된다 — `sourceType` enum 외의 값은 저장 불가.

### 13.3 데이터 요구사항

Methodology 공개를 위해 다음 데이터가 노출 가능해야 한다:
- 리뷰 약사의 `pharmacist_profiles` 전체 (이미 존재)
- `medication_references.sourceType` 분포 (dashboard에서 집계)
- 화이트리스트 sourceType enum (고정 상수, Tier별 분류)
- `CATEGORY_SOURCE_PRIORITY` 매핑 (공개 페이지에서 읽기 쉬운 표 형태로 노출)
- Affiliate 정책 (MDX 문서로 작성)

### 13.4 운영 정책 (KPI)

| 지표 | 목표 |
|---|---|
| 모든 published medication의 출처 개수 | ≥ 3개 |
| Tier 1 출처 최소 1개 포함 비율 | 100% |
| 카테고리 권장 Tier 2 출처 1개 이상 포함 비율 | ≥ 80% |
| 승인 후 6개월 미업데이트 제품 | < 10% |
| 출처 링크 깨짐률 (분기 점검) | < 5% |
| Tier 3 단독 claim (정책 위반) | 0건 |
| Methodology 페이지 이탈율 | 트래킹만, 특정 목표 없음 |

### 13.5 Trust Bar (모든 compare 페이지에 고정 표시)

제품 상세 hero 바로 아래. 표시되는 sourceType 배지는 해당 medication의 카테고리에 따라 달라진다 (의약품이면 FDA·PubMed, 화장품이면 AAD·CIR 등).

```
┌──────────────────────────────────────────────────┐
│ 🩺 Last reviewed by Dr. [Name], PharmD · 2026-04 │
│ 📚 Sources: [category-specific badges] (N refs) │
│ 💰 No paid placements — [How we stay independent]│
└──────────────────────────────────────────────────┘
```

예시:
- 두통약 상세 페이지: *"Sources: FDA, PubMed, Cochrane (5 refs)"*
- 수분크림 상세 페이지: *"Sources: AAD, CIR, DermNet NZ, PubMed (6 refs)"*
- 비타민 D 상세 페이지: *"Sources: NIH ODS, PubMed, USP (4 refs)"*

각 요소는 methodology 페이지의 해당 섹션으로 앵커 링크.

---

## 14. Product Lookup — 홈 우측 컬럼 핵심 UX

**역할:** 사용자가 사이트에 방문한 즉시 "**이 제품 뭐야?**"라고 물을 수 있는 통로. 본 사이트의 가장 강력한 "와우 모멘트" 기능이며, 홈 페이지 진입 → 가치 체감까지의 시간을 수초 단위로 단축한다.

**결합:** Compare 기능(섹션 6)과 Product Lookup은 **같은 medication 데이터를 공유**한다. Lookup은 Compare 시스템으로 들어가는 가장 빠른 경로.

### 14.1 사용자 플로우

```
[사용자 입력: 텍스트 또는 이미지]
       │
       ▼
┌──────────────────────────────────┐
│  1. DB fuzzy match 시도          │
│     (medications 테이블)         │
└──────────────────────────────────┘
       │
       ├─── HIT (약사 검토 제품) ────┐
       │                             ▼
       │                    /compare/[cat]/[med]
       │                    (★ 완전한 신뢰 + 전체 분석)
       │
       └─── MISS ──────────────────┐
                                    ▼
                         ┌──────────────────────┐
                         │ 2. Gemini AI 분석    │
                         │    (텍스트/비전)     │
                         │    + 출처 suggest    │
                         └──────────────────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │ 3. 경고 배지 포함    │
                         │    AI 결과 표시       │
                         │    ⚠️ Not reviewed   │
                         │    [Request review]  │
                         └──────────────────────┘
                                    │
                                    ▼
                         [리드 수집: 리뷰 대기 큐]
```

### 14.2 입력 방식

#### Phase 1 (MVP) — 텍스트 입력
- Autocomplete 검색 박스
- `medications` 테이블에서 `name`, `genericName`, `brandNames` 모두 대상
- PostgreSQL `pg_trgm` 확장으로 fuzzy 매칭 ("Tylonol" → "Tylenol" 교정)
- Debounced 300ms
- Popular lookups: `product_lookups` 테이블 집계로 인기 쿼리 노출

#### Phase 2 — 이미지 업로드
- 파일 선택 또는 드래그앤드롭
- 클라이언트에서 EXIF 스트립 + 이미지 리사이즈 (max 1024px)
- Supabase Storage `product-lookups` 버킷 (private, 24h TTL)
- Gemini Flash의 **multimodal 비전**으로 제품 식별:
  1. OCR로 라벨의 브랜드명/성분 추출
  2. 제품명을 텍스트 검색으로 연결 (Phase 1 파이프라인 재사용)
  3. 텍스트 매칭 실패 시 비전 분석 결과 자체로 AI 분석 생성
- **모바일 카메라 직접 촬영 지원** (`<input type="file" accept="image/*" capture="environment">`)

### 14.3 AI 파이프라인 (기존 인프라 재사용)

| 단계 | 기술 |
|---|---|
| 텍스트 매칭 | Drizzle + pg_trgm similarity |
| 이미지 인식 | `gemini-2.5-flash` multimodal (기존 `@ai-sdk/google`) |
| 분석 생성 | `generateObject` with Zod schema (기존 extract-products 패턴) |
| 출처 suggest | 기존 `/api/ai/extract-references` 라우트 재활용 |
| maxRetries | `0` (기존 라우트와 동일한 쿼터 보호 정책) |

### 14.4 신규 데이터 모델

#### `product_lookups` 테이블 (캐시 + 리드 수집)

```ts
id: bigint (pk, generated)
queryText: text                    // 정규화된 검색어 (lowercase, trimmed)
queryImageHash: text (nullable)    // 업로드 이미지의 SHA256 (동일 이미지 중복 방지)
matchedMedicationId: bigint (fk nullable) // DB hit 시
aiAnalysis: jsonb (nullable)       // DB miss 시 AI 생성 결과
sources: jsonb (nullable)          // AI가 제안한 출처 후보 배열
anonSessionId: text                // 익명 세션 (rate limiting용, localStorage 또는 서버 쿠키)
reviewRequested: boolean (default false) // "Request pharmacist review" 클릭 여부
reviewRequestedAt: timestamp
createdAt: timestamp
expiresAt: timestamp                // 캐시 TTL (기본 24h, DB hit은 영구)

INDEX idx_product_lookups_query_text (queryText)
INDEX idx_product_lookups_session (anonSessionId, createdAt)
INDEX idx_product_lookups_review_queue (reviewRequested, reviewRequestedAt) WHERE reviewRequested
```

**캐시 정책:**
- 동일 `queryText` (normalized) → 24시간 이내 결과 재사용
- 동일 `queryImageHash` → 7일 이내 결과 재사용 (이미지 분석이 더 비싸므로 오래 캐시)
- DB hit은 캐시 불필요 (DB 쿼리가 AI보다 빠름)

#### `lookup_review_requests` 테이블 (선택 — 리드 수집 전용)

```ts
id, productLookupId (fk),
contactEmail (nullable),           // 결과 알림용
requesterNote: text (nullable),
status: enum ["pending", "in_progress", "done", "rejected"],
assignedTo (uuid fk pharmacist_profiles, nullable),
createdAt, completedAt
```

### 14.5 AI 결과 노출 정책 (★ 중요)

v4에서 **"AI draft 공개 금지"** 정책을 정했지만, Lookup은 예외. 단, **절대적으로 구분**되어야 한다.

**결과 카드 UI 레벨 분리:**

```
┌─────────────────────────────────────────────────┐
│ ✅ PHARMACIST-REVIEWED (DB hit 시)              │
├─────────────────────────────────────────────────┤
│ Trust bar: Last reviewed by Dr. X, PharmD       │
│ Full compare page preview with real sources    │
│ [See full analysis →] button                    │
└─────────────────────────────────────────────────┘

─ vs ─

┌─────────────────────────────────────────────────┐
│ ⚠️ AI-GENERATED — NOT YET PHARMACIST REVIEWED   │
│ (색상: 진한 경고 노랑/주황, 눈에 띄는 배너)    │
├─────────────────────────────────────────────────┤
│ Disclaimer: "This analysis was generated by AI │
│ and has not yet been reviewed by a licensed    │
│ pharmacist. Please verify with your pharmacist │
│ or doctor before use."                          │
│                                                 │
│ AI summary (plain language)                     │
│ Suggested sources (unverified, gray badges)     │
│                                                 │
│ [Request pharmacist review] primary button     │
│ [See similar reviewed products] secondary      │
└─────────────────────────────────────────────────┘
```

**핵심 원칙:**
- AI 결과 카드는 `isAiDrafted = true`에 해당하며 **절대 Compare 페이지의 pharmacist-reviewed UI와 시각적 혼동 불가**
- AI 결과에는 **"Last reviewed by" 배지 없음**, **comparisonScore 없음**, **"Best for" 같은 추천 문구 없음**
- 모든 AI factual claim은 "suggested source" 회색 배지로만 표시 (green "verified" 배지 사용 금지)
- `noindex` 메타 태그로 SEO 인덱싱 방지 (AI 생성 페이지가 검색결과에 나와 트러스트 손상 방지)
- AI 결과 URL은 `/lookup/[hash]` 형태로 compare URL 공간과 분리

### 14.6 이미지 프라이버시 및 처리

- **클라이언트 사이드 EXIF 스트립** (GPS, 기기 정보 등 제거)
- 업로드 전 `max 1024px` 리사이즈 (업로드 속도·저장 용량 최적화)
- Supabase Storage bucket `product-lookups` — private, signed URL로 접근
- **24시간 후 자동 삭제** (Supabase Storage 수명 주기 정책 + cron)
- 프라이버시 정책에 명시: "We delete uploaded images within 24 hours. We never link images to your identity."
- 사용자가 로그인하지 않은 경우 `anonSessionId`만 사용

### 14.7 Rate Limiting

| 대상 | 제한 |
|---|---|
| 익명 사용자 (IP 기반) | 10 lookups / day |
| 익명 사용자 (세션 기반) | 20 lookups / day |
| 캐시 히트 | 카운트 제외 |
| DB hit | 카운트 제외 (AI 호출 없음) |
| AI 호출 (Gemini) | 전역 분당 15회 (Gemini 무료 티어 20 req/min 보호) |

초과 시 "Daily limit reached. Try again tomorrow or [create a free account] for more lookups." 메시지.

### 14.8 "Request Pharmacist Review" 워크플로

AI 결과 카드에 **"Request pharmacist review"** 버튼 노출. 클릭 시:

1. Modal 오픈 — 선택 입력: email (결과 알림용), note ("What would you like to know?")
2. `lookup_review_requests` 테이블에 insert, `reviewRequested = true`
3. 약사 admin dashboard에 새 큐 섹션 "Review Requests" 표시
4. 약사가 처리 완료 시:
   - 해당 medication을 정식 `medications` 테이블에 추가
   - 출처 검증 및 pharmacist-reviewed 상태로 승인
   - 요청자에게 이메일 알림 (`contactEmail` 있을 경우)
5. **비즈니스 가치:** 어떤 제품을 사람들이 찾는지 데이터 수집 → 콘텐츠 우선순위 결정

### 14.9 검색 자동완성·인기 lookups

- 검색 입력 시 debounced autocomplete — Drizzle + pg_trgm
- 결과 드롭다운:
  - DB hit 제품 (Pharmacist-Reviewed 배지)
  - 최근 인기 쿼리 (`product_lookups` 집계 기반)
- "Popular lookups" 섹션은 홈 Lookup 위젯 아래에 노출 — 빈 상태 완화 + discovery

### 14.10 구현 Phase

| Phase | 내용 | 산출물 |
|---|---|---|
| **14-1** | `product_lookups`, `lookup_review_requests` 테이블 마이그레이션 | Drizzle 마이그레이션 |
| **14-2** | pg_trgm 확장 활성화 + `getMedicationByFuzzyMatch` 서버 액션 | `src/lib/actions/medications.ts` |
| **14-3** | 홈 우측 Lookup 위젯 (텍스트 전용 MVP) | `ProductLookup` 컴포넌트 |
| **14-4** | `/api/lookup/text` 라우트 (DB hit → redirect, miss → AI 분석) | API route |
| **14-5** | AI 결과 카드 UI (경고 배지, 출처 회색 표시, Request 버튼) | `AiLookupResult` 컴포넌트 |
| **14-6** | `lookup_review_requests` + 약사 admin review queue | admin 페이지 확장 |
| **14-7** | 모바일 Lookup hero-승격 레이아웃 + horizontal scroll Compare chips | 홈 페이지 리팩터 |
| **14-8** | Supabase Storage bucket + 이미지 업로드 UI | 인프라 + UI |
| **14-9** | Gemini multimodal 비전 파이프라인 (`/api/lookup/image`) | API route |
| **14-10** | 24시간 이미지 auto-delete cron | Supabase Edge Function |

**MVP 범위:** Phase 14-1 ~ 14-6 (텍스트 Lookup + AI 분석 + 리드 수집). Phase 14-7 이후는 모바일·이미지 확장.

### 14.11 KPI

| 지표 | 목표 (출시 후 3개월) |
|---|---|
| 일일 Lookup 시도 수 | 100+ |
| DB hit 비율 | 30%+ (초기) → 60%+ (큐레이션 진행) |
| "Request pharmacist review" 클릭률 (AI miss 중) | 15%+ |
| AI miss → review 승인 → 실제 medication 등록 | 주 5개+ |
| Lookup 후 compare page 이동 비율 | 50%+ |

### 14.12 결정된 사항 (섹션 14 로컬)

| 항목 | 결정 |
|---|---|
| Phase 우선순위 | **텍스트 먼저 (Phase 14-1~14-6), 이미지 후속 (14-7~14-10)** |
| 홈 레이아웃 배치 | **공존** — Lookup 상단, Latest Articles 하단 |
| 모바일 위치 | **Hero 바로 아래로 승격** |
| AI 결과 노출 | **허용하되 경고 배지·구분된 UI·noindex**로 철저히 분리 |
| 리드 수집 | `lookup_review_requests` + 약사 admin 큐 |
| Rate limit | 익명 10/day (IP), 20/day (세션), 캐시·DB hit 제외 |
| 이미지 보관 | 24시간 후 자동 삭제, EXIF 스트립, 리사이즈 |

@AGENTS.md

# Pharmacist 프로젝트

약사가 OTC(일반의약품)를 분야별로 분석하여 추천 기사를 게시하는 영어 웹사이트.

## 기술 스택
- **프레임워크:** Next.js 16 (App Router)
- **배포:** Vercel
- **DB:** Supabase (PostgreSQL)
- **ORM:** Drizzle ORM
- **인증:** Supabase Auth (약사/일반 사용자 역할)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **에디터:** Plate (리치 텍스트)
- **LLM:** Vercel AI SDK + Anthropic Claude
- **SEO:** Next.js Metadata API + next-sitemap
- **유효성 검사:** Zod
- **다국어:** next-intl (영어 우선, 향후 확장)
- **패키지 매니저:** pnpm

## 규칙
- 커뮤니케이션과 문서는 **한국어**로 작성
- 코드(변수명, 함수명)와 사이트 콘텐츠는 **영어**로 작성
- 코드 작성 전 `node_modules/next/dist/docs/`의 관련 가이드를 반드시 확인

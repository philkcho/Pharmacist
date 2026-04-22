# AI PharmCare

Health & Beauty 트렌드를 AI로 분석하고 라이선스를 보유한 약사(Dr. Younghun Cho, PharmD)가 검토하여 관련 제품 구매로 연결하는 영어 웹사이트. 도메인: `aipharmcare.com`.

## 환경변수

- `NEXT_PUBLIC_SITE_NAME=AI PharmCare` — 브랜드명 (기본값 `AI PharmCare`, `src/lib/brand.ts` 참조)
- `NEXT_PUBLIC_SITE_URL=https://www.aipharmcare.com` — 프로덕션 URL

## 기술 스택

- **프레임워크:** Next.js 16 (App Router) + TypeScript
- **배포:** Vercel
- **DB:** Supabase (PostgreSQL)
- **UI:** Tailwind CSS v4 + shadcn/ui
- **패키지 매니저:** pnpm

## 시작하기

```bash
# 의존성 설치
pnpm install

# 개발 서버 실행
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 서버 실행
pnpm start
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 프로젝트 구조

```
src/
  app/          # Next.js App Router 페이지
  components/   # UI 컴포넌트
  lib/          # 유틸리티, Supabase 클라이언트 등
```

## 배포

Vercel에 배포합니다. `main` 브랜치에 push하면 자동 배포됩니다.

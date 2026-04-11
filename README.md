# Dr.pharmacist

약사가 OTC(일반의약품)를 분야별로 분석하여 추천 기사를 게시하는 영어 웹사이트.

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

# 코드 및 문서 분석 리포트 (Code vs Docs Gap Analysis)

## 1. 개요 (Overview)
본 리포트는 현재 `docs/system-architecture.md` 문서와 실제 프로젝트 코드베이스 간의 차이점을 분석하여 정리한 것입니다.

## 2. 분석 대상 (Scope)
- **문서**: `docs/system-architecture.md`
- **코드베이스**: `apps/`, `packages/` 디렉토리 전체 구조 및 주요 설정 파일 (`package.json`, `tsconfig.json` 등)

## 3. 주요 발견 사항 (Key Findings)

### 3.1. 패키지 구조 (Package Structure)
- **문서 내용**:
  - `apps/web`, `apps/server`
  - `packages/core`, `packages/proto`, `packages/scoring`
- **실제 코드**:
  - 위 5개 패키지 외에 **`packages/bot`** 및 **`packages/assets`** 디렉토리가 존재함.
  - 현재 이 두 패키지는 초기화 상태(placeholder)로 보이며, `package.json`에 빌드 스크립트가 구현되어 있지 않음 (`echo 'No build step...'`).

### 3.2. 코어 패키지 의존성 (Core Dependencies)
- **문서 내용**: `packages/core`가 XState 게임 머신을 포함한다고 명시.
- **실제 코드**:
  - `packages/core/package.json`에서 `xstate` (^5.0.0) 의존성을 확인.
  - `@step13/proto`, `@step13/scoring`에 대한 워크스페이스 의존성(`workspace:*`) 확인됨.

### 3.3. 서버 설정 (Server Configuration)
- **문서 내용**: `apps/server/src/index.ts`가 `RULESET` 환경 변수를 사용한다고 명시.
- **실제 코드**:
  - `apps/server/src/index.ts` 파일 내 `process.env.RULESET ?? 'classic'` 구문 확인됨. 문서 내용과 일치함.

## 4. 권장 수정 사항 (Recommendations)
1. **문서 업데이트**:
   - `packages/bot` 및 `packages/assets`에 대한 언급을 추가하여 전체 프로젝트 구조를 정확히 반영. (비록 현재는 초기 상태라 할지라도 존재 여부는 명시하는 것이 좋음, 혹은 향후 계획으로 언급)
   - `packages/scoring`과 `packages/proto`의 역할 재확인 및 명시 (현재 문서는 정확함).

## 5. 결론 (Conclusion)
전반적으로 `docs/system-architecture.md`는 현재 시스템의 핵심 아키텍처를 매우 정확하게 반영하고 있습니다. 다만, 프로젝트 구조상 존재하는 일부 추가 패키지(`bot`, `assets`)에 대한 정보가 누락되어 있어 이를 보완할 필요가 있습니다.

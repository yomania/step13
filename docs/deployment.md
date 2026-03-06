# 서비스 배포 (Deployment) 가이드

기준일: `2026-03-06`

Step13 운영 배포는 **Railway** 기준으로 관리합니다.  
서버(`apps/server`)가 정적 웹(`apps/web/dist`)을 함께 서빙하므로, 단일 서비스로 Web + API + WebSocket(`/ws`)를 동시 운영합니다.

## 현재/목표 상태

- 기존 운영 플랫폼: Render (`mind17step.onrender.com`)
- 목표 운영 플랫폼: Railway (`<service>.up.railway.app` 또는 커스텀 도메인)
- 전환 원칙:
  - 전환 기간에는 `CORS_ORIGINS`에 구 도메인/신 도메인을 함께 등록
  - 검증 완료 후 `VITE_API_URL`과 도메인 안내를 Railway 도메인으로 단일화

## Railway 배포 절차

1. Railway 프로젝트를 생성하고 이 저장소를 연결합니다.
2. 루트 `Dockerfile` 기반으로 빌드/배포합니다.
3. 필수 환경 변수를 설정합니다.
   - `NODE_ENV=production`
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `CORS_ORIGINS`
   - `ROOM_IDLE_TTL_MS` (선택)
   - `ROOM_CLEANUP_INTERVAL_MS` (선택)
4. 첫 배포 전에 DB 스키마를 반영합니다.
   - `pnpm --filter server db:push`
5. 배포 후 아래를 점검합니다.
   - `GET /` 응답
   - `POST /auth/login` 정상 동작
   - `wss://<도메인>/ws` 연결 및 재연결 동작

## 도메인/환경 변수 운영 기준

- `VITE_API_URL`은 최종적으로 Railway 운영 도메인을 사용합니다.
- `CORS_ORIGINS`는 실제 접속 가능한 Web 도메인만 허용합니다.
- 커스텀 도메인 전환 시:
  1. DNS 연결 완료
  2. `CORS_ORIGINS`에 커스텀 도메인 추가
  3. `VITE_API_URL` 업데이트
  4. 구 도메인 제거

## 롤백 가이드

- Railway 배포 이슈 발생 시 즉시 Render 도메인으로 트래픽을 되돌릴 수 있도록 전환 기간 동안 설정을 유지합니다.
- 롤백 시 필수 조치:
  - `VITE_API_URL`을 Render 도메인으로 복구
  - `CORS_ORIGINS`에 Render 도메인이 포함되어 있는지 확인

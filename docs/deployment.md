# 서비스 배포 (Deployment) 가이드

기준일: `2026-03-20`

Step13 운영 배포는 **Railway** 기준으로 관리합니다.  
웹은 ruleset 선택에 따라 서로 다른 서버 배포로 전환할 수 있으며, 각 서버는 같은 인증 저장소/JWT 설정을 공유한 상태에서 서로 다른 `RULESET`으로 실행됩니다.

## 현재/목표 상태

- 기존 운영 플랫폼: Render (`mind17step.onrender.com`)
- 현재 classic Railway 서비스 도메인: `https://step13-production.up.railway.app`
- 추가 ruleset 서비스: `ten_attack_defense`, `ten_attack_defense_easy` 전용 서비스
- 목표 운영 플랫폼: Railway (위 도메인 또는 커스텀 도메인)
- 전환 원칙:
  - 전환 기간에는 `CORS_ORIGINS`에 구 도메인/신 도메인을 함께 등록
  - 검증 완료 후 `VITE_API_URL`과 도메인 안내를 Railway 도메인으로 단일화

## Railway 배포 절차

1. ruleset별 Railway 서비스를 생성하고 같은 저장소를 연결합니다.
2. 각 서비스는 루트 `Dockerfile` 기반으로 빌드/배포합니다.
3. 모든 서비스에 공통 환경 변수를 설정합니다.
   - `NODE_ENV=production`
   - `JWT_SECRET`
   - `DATABASE_URL`
   - `CORS_ORIGINS`
   - `ROOM_IDLE_TTL_MS` (선택)
   - `ROOM_CLEANUP_INTERVAL_MS` (선택)
4. 서비스별 차등 환경 변수를 설정합니다.
   - `RULESET=classic` 또는 `ten_attack_defense` 또는 `ten_attack_defense_easy`
   - 웹 배포에는 `VITE_CLASSIC_*`, `VITE_TEN_*`, `VITE_TEN_EASY_*` endpoint 세트
5. 첫 배포 전에 DB 스키마를 반영합니다.
   - `pnpm --filter server db:push`
6. 배포 후 아래를 점검합니다.
   - `GET /` 응답
   - `POST /auth/login` 정상 동작
   - 각 ruleset 도메인의 `wss://<도메인>/ws` 연결 및 재연결 동작

## 도메인/환경 변수 운영 기준

- classic fallback은 `https://step13-production.up.railway.app` / `wss://step13-production.up.railway.app/ws`를 사용합니다.
- 웹은 exact ruleset 기준 endpoint를 사용합니다.
- `CORS_ORIGINS`는 실제 접속 가능한 Web 도메인만 허용합니다.
- 커스텀 도메인 전환 시:
  1. DNS 연결 완료
  2. 모든 ruleset 서비스의 `CORS_ORIGINS`에 커스텀 도메인 추가
  3. 웹의 `VITE_*` endpoint 세트 업데이트
  4. 구 도메인 제거

## 롤백 가이드

- Railway 배포 이슈 발생 시 즉시 Render 도메인으로 트래픽을 되돌릴 수 있도록 전환 기간 동안 설정을 유지합니다.
- 롤백 시 필수 조치:
  - affected ruleset의 `VITE_*` endpoint를 이전 도메인으로 복구
  - 모든 서비스의 `CORS_ORIGINS`에 복구 대상 Web 도메인이 포함되어 있는지 확인

# 서비스 배포 (Deployment) 가이드

기준일: `2026-02-25`

현재 Step13 프로젝트는 **Render** 플랫폼을 통해 운영(Production) 환경에 배포되어 있습니다.

## 배포 URL 정보

- **운영 Web 접속 주소 (Frontend)**: `https://mind17step.onrender.com`
- **운영 API Server 주소 (Backend)**: `https://mind17step.onrender.com` 

## 환경 변수 설정 기준

운영 환경에서는 보안 및 정상 동작을 위해 다음 환경 변수가 적절히 설정되어야 합니다. (상세 내용은 `docs/env.md` 참조)

1. **`CORS_ORIGINS` (Server)**
   - `https://mind17step.onrender.com` 주소가 반드시 화이트리스트에 포함되어 있어야 합니다.
2. **`VITE_API_URL` (Web)**
   - 프로덕션 배포 시 API 통신을 위해 `https://mind17step.onrender.com` 로 지정되어야 합니다.

## 관리 방안 가이드

- 클라이언트가 API를 호출하거나 소켓을 연결할 때 항상 운영 도메인(`mind17step.onrender.com`)을 기준으로 올바르게 요청할 수 있도록 파이프라인에 환경 변수를 주입해야 합니다.
- 새로운 서브도메인이 추가되거나 연동 서버(예: 분리된 봇 서버 등)가 생길 경우, 이 문서의 배포 URL 정보와 `docs/env.md`를 함께 갱신해야 합니다.

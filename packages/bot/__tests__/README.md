# 로그 기반 AI 조패 테스트

## 📁 구조

```
packages/bot/
├── __tests__/
│   ├── logs/                    # 게임 로그 JSON 파일들
│   │   ├── sample_game_1.json   # Honitsu vs Mixed Hand
│   │   ├── sample_game_2.json   # Chiitoitsu vs Standard
│   │   └── sample_game_3.json   # Chinitsu Full Flush
│   └── log_based.test.ts        # 로그 기반 테스트 로직
└── src/
    ├── logic.ts                 # BotLogic 구현
    └── analyze_log.test.ts      # 기존 단일 로그 테스트
```

## 🎯 목적

이 테스트는 다음을 검증합니다:

1. **AI가 User보다 높은 점수의 조패를 찾는지**
2. **고득점 패턴(Honitsu, Chinitsu 등)을 올바르게 인식하는지**
3. **다양한 게임 시나리오에서 일관되게 작동하는지**

## 📝 로그 파일 형식

`__tests__/logs/` 폴더에 JSON 파일을 추가하면 자동으로 테스트에 포함됩니다.

### JSON 스키마

```json
{
  "description": "테스트 시나리오 설명",
  "playerHandIds": [
    "z7", "z7", "z2", "z2", "z3", "z3",
    "pin2", "pin2", "pin7", "pin7", "pin4", "pin4",
    "z4"
  ],
  "aiHandIds": [
    "sou5", "pin4", "man8", "pin4", "sou5", "sou4",
    "man1", "man1", "pin2", "man9", "man9", "pin2", "sou4"
  ],
  "dealtTileIds": [
    "pin1", "z6", "man5", "sou5", "z4", "z2", "pin4", "man8",
    "sou2", "z3", "man7", "man3", "pin8", "pin4", "sou8", "pin7",
    "sou5", "sou4", "man1", "man1", "z7", "pin7", "pin2", "sou3",
    "man9", "z7", "man9", "z7", "z3", "pin2", "z2", "pin6", "pin5", "sou4"
  ],
  "doraIndicatorIds": ["pin1"],
  "expectedResult": {
    "playerShouldWin": true,
    "minPlayerHan": 6,
    "expectedYaku": ["Honitsu"]
  }
}
```

### 타일 ID 형식

- **만수패**: `man1` ~ `man9`
- **통수패**: `pin1` ~ `pin9`
- **삭수패**: `sou1` ~ `sou9`
- **자패**: `z1` ~ `z7` (동남서북백발중)

### expectedResult 필드

- `playerShouldWin`: (boolean) Player가 이겨야 하는지 여부
- `minPlayerHan`: (number) Player의 최소 기대 한 수
- `minAiHan`: (number) AI의 최소 기대 한 수
- `expectedYaku`: (string[]) 기대되는 역 목록

## 🧪 테스트 실행

### 전체 테스트 실행

```bash
npm run test
```

### 로그 기반 테스트만 실행

```bash
npm run test -- log_based.test.ts
```

### Watch 모드로 실행

```bash
npm run test -- --watch log_based.test.ts
```

## 📊 테스트 항목

각 로그 파일에 대해 다음 테스트가 수행됩니다:

### 1. 직접 핸드 점수 비교
Player와 AI의 핸드를 `evaluateHandQuality`로 평가하여 비교합니다.

### 2. AI 최적 조패 탐색
AI가 dealt tiles로부터 최적의 조패를 찾는지 검증합니다.
- 최소 한 수 검증
- 기대 역 포함 여부 검증

### 3. AI vs User 조패 우수성 비교
AI가 찾은 최적 조패가 User 조패보다 우수한지 검증합니다.

### 4. 고득점 패턴 인식
Honitsu, Chinitsu 같은 고득점 패턴을 AI가 올바르게 인식하는지 검증합니다.

### 5. 통합 테스트
모든 로그에서 AI가 유효한 조패를 찾는지 통합 검증합니다.

## 📈 출력 예시

```
[Honitsu vs Mixed Hand] - AI 후보 조패
총 8개의 후보 발견
  후보 1: 6한, 12000점
    역: Honitsu, Toitoi
    대기: 3개
  후보 2: 4한, 8000점
    역: Toitoi, Sanankou
    대기: 2개

[Honitsu vs Mixed Hand] - 최종 비교
Player: 3개 대기, 역: Honitsu
AI Best: 3개 대기, 6한, 12000점
AI 역: Honitsu, Toitoi

[통합 테스트 결과]
총 로그 수: 3
성공적인 조패 발견: 3
성공률: 100.0%
```

## 🔧 새 로그 추가 방법

1. `__tests__/logs/` 폴더에 새 JSON 파일 생성
2. 위의 JSON 스키마에 맞춰 데이터 작성
3. 테스트 실행 - 자동으로 새 로그가 포함됨

## 💡 팁

- **실제 게임 로그 활용**: 실제 게임에서 발생한 시나리오를 로그로 저장하여 회귀 테스트에 활용
- **엣지 케이스 추가**: 특이한 패턴이나 버그가 발견되면 로그로 저장하여 재발 방지
- **난이도 조정**: `log_based.test.ts`의 `difficulty` 변수를 수정하여 다른 난이도로 테스트 가능

## 🐛 디버깅

테스트 실패 시 콘솔 출력을 확인하여:
- AI가 찾은 후보들의 점수와 역
- Player와 AI의 최종 비교 결과
- 각 단계별 상세 정보

를 파악할 수 있습니다.

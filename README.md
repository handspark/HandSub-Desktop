# HandSub

빠르고 가벼운 데스크톱 메모 앱. 단축키 한 번으로 언제든 메모하세요.

---

## 설치 및 실행

### 요구사항

- Node.js 18+
- npm 또는 yarn

### 설치

```bash
# 저장소 클론
git clone https://github.com/handspark/HandSub-Desktop.git
cd HandSub-Desktop

# 의존성 설치
npm install

# 앱 실행
npm start
```

### 빌드

```bash
# macOS
npm run dist:mac

# Windows
npm run dist:win
```

빌드된 파일은 `dist/` 폴더에 생성됩니다.

---

## 주요 기능

- **글로벌 단축키**: 어디서든 `Cmd+Shift+Space`로 즉시 메모
- **자동 저장**: 입력과 동시에 자동 저장
- **스니펫**: 단축어로 Webhook, HTTP 요청 실행
- **미디어 지원**: 이미지, 동영상 붙여넣기
- **링크 미리보기**: URL 입력 시 OG 메타데이터 표시
- **체크리스트**: `[ ]` 입력으로 체크박스 생성

---

## 단축키

| 동작 | Mac | Windows |
|------|-----|---------|
| 앱 열기 | `Cmd+Shift+Space` | `Ctrl+Shift+Space` |
| 새 메모 | `Cmd+Shift+N` | `Ctrl+Shift+N` |
| 창 닫기 | `ESC` | `ESC` |

---

## 커스텀 도구 만들기

`tools/` 폴더에 새 도구를 추가하여 스니펫 기능을 확장할 수 있습니다.

### 폴더 구조

```
tools/
├── index.js          # 도구 레지스트리
├── BaseTool.js       # 기본 도구 클래스
├── ManifestTool.js   # 매니페스트 도구 클래스
├── _template/        # 도구 템플릿 (참고용)
├── webhook/          # Webhook 도구
└── http/             # HTTP 도구
```

### 매니페스트 도구 만들기

1. `tools/` 폴더에 새 폴더 생성 (예: `tools/slack/`)

2. `manifest.json` 파일 작성:

```json
{
  "name": "Slack",
  "icon": "💬",
  "description": "Slack으로 메시지 보내기",
  "settings": {
    "webhookUrl": {
      "type": "text",
      "label": "Webhook URL",
      "placeholder": "https://hooks.slack.com/services/...",
      "required": true
    }
  },
  "commands": [
    {
      "shortcut": "슬랙",
      "name": "메시지 보내기",
      "fields": [
        {
          "name": "message",
          "label": "메시지",
          "type": "text"
        }
      ],
      "request": {
        "method": "POST",
        "url": "{{webhookUrl}}",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": {
          "text": "{{message}}"
        }
      }
    }
  ]
}
```

3. 앱 재시작 → 설정에서 도구 연결 → 메모에서 `/슬랙` 입력

### manifest.json 스펙

| 필드 | 설명 |
|------|------|
| `name` | 도구 이름 |
| `icon` | 이모지 아이콘 |
| `description` | 도구 설명 |
| `settings` | 설정 창에서 입력받을 값 (API 키 등) |
| `commands` | 단축어 명령어 목록 |

### commands 스펙

| 필드 | 설명 |
|------|------|
| `shortcut` | 호출 키워드 (예: `/슬랙`) |
| `name` | 명령어 이름 |
| `fields` | 실행 시 입력받을 필드 |
| `request` | HTTP 요청 설정 |

### 템플릿 변수

`{{변수명}}` 형식으로 동적 값 삽입:

- `{{settings의 key}}`: 설정에서 입력한 값
- `{{field의 name}}`: 실행 시 입력한 값
- `{{content}}`: 선택한 텍스트
- `{{editorContent}}`: 메모 전체 내용

---

## 프로젝트 구조

```
HandSub-Desktop/
├── main.js              # Electron 메인 프로세스
├── preload.js           # IPC 브릿지
├── index.html           # 메인 창
├── style.css            # 스타일
├── settings.html        # 설정 창
├── settings.css         # 설정 스타일
├── settings-renderer.js # 설정 로직
├── renderer/            # 렌더러 모듈
│   ├── index.js         # 진입점
│   ├── editor.js        # 에디터 로직
│   ├── memo.js          # 메모 CRUD
│   ├── snippet.js       # 스니펫 실행
│   └── ...
└── tools/               # 커스텀 도구
```

---

## 데이터 저장 위치

| OS | 경로 |
|----|------|
| macOS | `~/Library/Application Support/handsub/` |
| Windows | `%APPDATA%/handsub/` |

```
handsub/
├── handsub.db    # SQLite 데이터베이스
├── config.json   # 설정 파일
└── images/       # 미디어 파일
```

---

## 기술 스택

- **Electron** - 크로스 플랫폼 데스크톱
- **better-sqlite3** - 로컬 데이터베이스
- **Vanilla JS** - 프레임워크 없이 순수 JS

---

## 라이선스

MIT License

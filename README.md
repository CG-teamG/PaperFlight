# ✈️ Paper Flight — GitHub 협업 가이드

## 1. 프로젝트 소개

**Paper Flight**는 3D 공간에서 종이비행기를 조종하며 다양한 지형을 탐험하는 비행 시뮬레이션 게임입니다.

- **개발 환경:** React, Vite, Three.js
- **개발 언어:** JavaScript
- **협업 도구:** Git, GitHub, Visual Studio Code

## 2. 브랜치 관리 규칙

팀원별 작업 브랜치를 사용하고, 완성된 코드는 `develop`에 통합합니다.

| 브랜치 | 용도 |
|---|---|
| `main` | 최종 제출용 안정 버전 |
| `develop` | 팀원별 작업을 통합하고 테스트하는 브랜치 |
| `feature/팀원A이름` | 3D 모델링 및 그래픽 환경 |
| `feature/팀원B이름` | 비행 조작 및 물리 시스템 |
| `feature/팀원C이름` | 링 판정, 탐험 시스템 및 UI |

> `팀원A이름`, `팀원B이름`, `팀원C이름`은 실제 팀원의 영문 이름 또는 GitHub 아이디로 변경합니다.

### 브랜치 작업 흐름

1. 각 팀원은 `develop`에서 자신의 작업 브랜치를 생성합니다.
2. 자신의 브랜치에서 담당 기능을 개발합니다.
3. 작업 내용을 커밋하고 GitHub에 푸시합니다.
4. GitHub에서 자신의 브랜치에서 `develop`으로 Pull Request를 생성합니다.
5. 코드 확인 및 테스트 후 Merge합니다.
6. 최종 테스트가 끝나면 `develop`에서 `main`으로 Merge합니다.

**주의:** `main`과 `develop`에서 직접 기능을 개발하지 않습니다.

## 3. 팀원별 담당 업무

### 문선유 — 3D 모델링 및 그래픽 환경

- 종이비행기 모델 및 재질 구성
- 산, 숲, 바다 등 3D 지형 제작
- 링 오브젝트 모델링 및 배치
- 하늘, 구름, 조명 및 카메라 설정
- 비행 궤적 및 파티클 시각 효과

### 장세창 — 3D 변환 및 비행 시스템

- 키보드 입력에 따른 비행기 이동 및 방향 제어
- 3D 좌표 변환 및 회전 애니메이션
- 중력과 바람에 따른 속도 및 이동 계산
- 비행기에 따른 카메라 이동
- 링 판정과 궤적 계산에 필요한 비행기 위치 정보 제공

### 김예빈 — 링 판정 및 탐험 시스템

- 링 통과 여부 판정 및 성공 처리
- 통과한 링 개수 관리
- 지형 탐험 구역 진입 및 발견 판정
- 탐험 지도 갱신 및 탐험률 계산
- 발견한 지형과 탐험 기록 표시
- 시작, 일시 정지, 결과 화면 UI 구현

## 4. 최초 프로젝트 설정

프로젝트를 처음 내려받는 팀원은 다음 순서로 진행합니다.

### ① 저장소 복제

GitHub 저장소 페이지에서 HTTPS 주소를 복사한 후 터미널에서 실행합니다.

```bash
git clone 저장소_URL
cd paper-flight
```

> 실제 프로젝트 폴더 구조에 따라 `cd` 명령은 조정합니다.

### ② 패키지 설치

```bash
npm install
```

### ③ 개발 서버 실행

```bash
npm run dev
```

터미널에 표시된 로컬 주소를 브라우저에서 열어 실행 여부를 확인합니다.

## 5. 브랜치 생성 및 이동

### 최초 브랜치 생성

저장소를 복제한 뒤 `develop` 브랜치가 이미 존재하는지 확인합니다.

```bash
git fetch origin
git branch -a
```

`develop`이 이미 있다면 다음 명령으로 이동합니다.

```bash
git switch --track origin/develop
```

이미 로컬에 `develop`이 있다면 다음을 사용합니다.

```bash
git switch develop
git pull origin develop
```

이후 자신의 작업 브랜치를 생성합니다.

```bash
git switch -c feature/본인이름
git push -u origin feature/본인이름
```

### 기존 작업 브랜치로 이동

```bash
git switch feature/본인이름
```

## 6. 작업 내용 저장 및 업로드

작업을 완료한 후 자신의 브랜치에서 다음 명령을 실행합니다.

### ① 변경 파일 확인

```bash
git status
```

### ② 변경 내용 스테이징

```bash
git add .
```

### ③ 커밋

```bash
git commit -m "feat: 작업 내용"
```

### ④ GitHub에 업로드

```bash
git push
```

> `git add .` 실행 전에는 변경 파일을 확인합니다. `.env`, 비밀번호, API 키 등 민감한 정보는 업로드하지 않습니다.

## 7. 커밋 메시지 규칙

커밋 메시지는 변경 목적을 짧고 명확하게 작성합니다.

| 접두사 | 사용 목적 | 예시 |
|---|---|---|
| `feat` | 새로운 기능 추가 | `feat: add flight controls` |
| `fix` | 오류 수정 | `fix: correct plane movement` |
| `style` | 코드 스타일 및 서식 변경 | `style: adjust game HUD layout` |
| `refactor` | 기능 변경 없는 코드 구조 개선 | `refactor: separate ring logic` |
| `docs` | 문서 수정 | `docs: update README` |
| `test` | 테스트 코드 및 테스트 관련 변경 | `test: add ring detection tests` |

## 8. 최신 코드 가져오기

팀원들이 `develop`에 코드를 통합한 후, 자신의 작업 브랜치에서 최신 변경 사항을 가져올 수 있습니다.

```bash
git fetch origin
git merge origin/develop
```

충돌이 발생하면 해당 파일을 확인하고 팀원과 협의한 후 수정합니다.

충돌 해결 후에는 다음을 실행합니다.

```bash
git add .
git commit -m "fix: resolve merge conflicts"
git push
```

> 자신의 작업 내용을 커밋하지 않은 상태에서 무작정 브랜치를 변경하거나 병합하지 않습니다. 중요한 작업은 먼저 커밋하거나 별도로 백업합니다.

## 9. Pull Request 규칙

`develop`에 코드를 통합할 때는 GitHub Pull Request를 사용합니다.

- **Base:** `develop`
- **Compare:** 자신의 작업 브랜치
- 제목은 변경 내용을 알 수 있도록 작성합니다.
- 무엇을 수정했는지, 테스트했는지 간단히 설명합니다.
- 충돌이나 실행 오류가 없는지 확인한 후 Merge합니다.
- `main`은 최종 결과물 제출 및 발표 준비가 완료된 시점에 갱신합니다.

### Pull Request 작성 예시

**제목:** `feat: implement flight controls`

**내용:**
- 키보드 입력에 따른 비행기 이동 구현
- 비행기 방향 전환 및 회전 처리
- 로컬 실행 테스트 완료

## 10. 협업 시 주의 사항

1. 자신의 담당 브랜치에서 작업합니다.
2. 다른 팀원의 파일을 수정해야 한다면 먼저 협의합니다.
3. `App.jsx`, `GameScene.js` 등 여러 기능이 연결되는 파일은 수정 전에 팀원과 공유합니다.
4. 다른 팀원의 작업 내용을 임의로 삭제하거나 덮어쓰지 않습니다.
5. 기능을 통합한 후에는 전체 프로젝트가 정상적으로 실행되는지 확인합니다.
6. `node_modules`는 Git에 올리지 않습니다.
7. `.gitignore`에 `node_modules`, `dist`, `.env` 등이 적절히 설정되어 있는지 확인합니다.

## 11. 기본 협업 순서 요약

```text
develop에서 작업 브랜치 생성
          ↓
      코드 개발
          ↓
     git add .
          ↓
      git commit
          ↓
       git push
          ↓
  GitHub Pull Request 생성
          ↓
develop에 Merge 및 통합 테스트
          ↓
  최종 검증 후 main에 Merge
```

**모든 팀원은 자신의 작업 내용을 자주 커밋하고, 기능이 완성되면 Pull Request를 통해 통합합니다.**

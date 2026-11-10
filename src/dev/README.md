# 비행 테스트

`npm run dev` 실행 후 터미널에 표시된 주소의 `/flight-test.html`을 연다.

- `←`·`→`: 요, `↑`·`↓`: 피치, `A`·`D`: 롤
- 삼각형과 격자는 테스트용이다.
- 테스트 화면은 공통 `App.jsx`와 CSS를 사용하지 않는다.
- 기본 빌드에는 테스트 화면을 포함하지 않는다.

## 연동 인터페이스

비행기는 전방이 로컬 `+Z`, 위쪽이 `+Y`인 Three.js 객체를 사용한다.

```js
import { FlightController } from '../game/FlightController.js'
import { updateFollowCamera } from '../game/FollowCamera.js'

const controller = new FlightController(airplane)

// 매 프레임 호출. deltaTime은 초 단위
controller.update(deltaTime)
updateFollowCamera(airplane, camera)

// 종료 시 키보드 이벤트 제거
controller.dispose()
```

비행기를 장면에 직접 추가했다면 `airplane.position`을 링·탐험 시스템에 전달한다.

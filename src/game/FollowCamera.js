import { Vector3 } from 'three'

export function updateFollowCamera(airplane, camera, { distance = 10, height = 4, lookAhead = 4 } = {}) {
  // 전방을 따라가되 카메라는 롤에 기울어지지 않음
  const forward = airplane.getWorldDirection(new Vector3())
  camera.position.copy(airplane.position).addScaledVector(forward, -distance)
  camera.position.y += height
  const target = airplane.position.clone().addScaledVector(forward, lookAhead)
  camera.lookAt(target)
}

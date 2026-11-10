import { Vector3 } from 'three'

export function updateFollowCamera(airplane, camera) {
  // 전방을 따라가되 카메라는 롤에 기울어지지 않음
  const forward = airplane.getWorldDirection(new Vector3())
  camera.position.copy(airplane.position).addScaledVector(forward, -10)
  camera.position.y += 4
  const target = airplane.position.clone().addScaledVector(forward, 4)
  camera.lookAt(target)
}

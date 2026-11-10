import * as THREE from 'three'

export function createTestAirplane() {
  // 삼각형의 앞쪽은 +Z 방향
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1, 0, -1,
    1, 0, -1,
    0, 0, 2,
  ], 3))

  const material = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide,
  })

  return new THREE.Mesh(geometry, material)
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createTestAirplane } from './createTestAirplane.js'
import { FlightController } from '../game/FlightController.js'
import { updateFollowCamera } from '../game/FollowCamera.js'

export default function FlightTest() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xdbeafe)

    const grid = new THREE.GridHelper(200, 100)
    grid.position.y = -2
    scene.add(grid)

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)

    const renderer = new THREE.WebGLRenderer()
    container.appendChild(renderer.domElement)

    const airplane = createTestAirplane()
    scene.add(airplane)
    const controller = new FlightController(airplane)

    function resize() {
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }

    resize()
    window.addEventListener('resize', resize)

    let previousTime = performance.now()
    renderer.setAnimationLoop((time) => {
      const deltaTime = (time - previousTime) / 1000
      previousTime = time
      controller.update(deltaTime)
      updateFollowCamera(airplane, camera)
      renderer.render(scene, camera)
    })

    return () => {
      renderer.setAnimationLoop(null)
      window.removeEventListener('resize', resize)
      controller.dispose()
      grid.dispose()
      airplane.geometry.dispose()
      airplane.material.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className="flight-test" />
}

import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { createTestAirplane } from './createTestAirplane.js'

export default function FlightTest() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xdbeafe)

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100)
    camera.position.set(0, 6, -8)
    camera.lookAt(0, 0, 0)

    const renderer = new THREE.WebGLRenderer()
    container.appendChild(renderer.domElement)

    const airplane = createTestAirplane()
    scene.add(airplane)

    function resize() {
      const width = container.clientWidth
      const height = container.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      renderer.render(scene, camera)
    }

    resize()
    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      airplane.geometry.dispose()
      airplane.material.dispose()
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} className="flight-test" />
}

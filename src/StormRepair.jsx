import { useEffect, useRef, useState } from 'react'

import { portsAt, traceCircuit } from './game/RepairCircuit.js'

const DIRECTIONS = ['위', '오른쪽', '아래', '왼쪽']
const ENDPOINTS = [[16, 0], [32, 16], [16, 32], [0, 16]]

export default function StormRepair({ repairRequired, initialCircuit, onNewCircuit, onRepair, onTakeOff, onFinish }) {
  const dialog = useRef(null)
  const [circuit, setCircuit] = useState(initialCircuit)
  const { powered, complete } = traceCircuit(circuit)

  useEffect(() => {
    const modal = dialog.current
    modal.showModal()
    return () => modal.close()
  }, [])

  return (
    <dialog ref={dialog} className="pause-modal storm-repair" aria-labelledby="repair-title"
      onCancel={(event) => event.preventDefault()}>
      <h2 id="repair-title">{repairRequired ? '방재 장치 복구' : complete ? '폭풍 해소' : '착륙 완료'}</h2>
      {repairRequired ? (
        <>
          <p>회로 조각을 눌러 90°씩 돌리세요. 왼쪽 위 전원에서 오른쪽 아래 방풍막까지 연결하면 복구할 수 있어요.</p>
          <div className="circuit-board" role="group" aria-label="방재 장치 회로">
            <span className="circuit-source">전원 →</span>
            <div className="circuit-tiles">
              {circuit.rotations.map((_, index) => {
                const ports = portsAt(index, circuit)
                return (
                  <button key={index} type="button" data-powered={powered.has(index)}
                    aria-label={(`회로 ${index + 1}: ${ports.map((port) => DIRECTIONS[port]).join(', ')}. 90도 회전`)}
                    onClick={() => setCircuit((current) => ({ ...current, rotations: current.rotations.map((turn, tile) => tile === index ? (turn + 1) % 4 : turn) }))}>
                    <svg viewBox="0 0 32 32" aria-hidden="true">
                      {ports.map((port) => (
                        <line key={port} x1="16" y1="16" x2={ENDPOINTS[port][0]} y2={ENDPOINTS[port][1]} />
                      ))}
                      <circle cx="16" cy="16" r="2.5" />
                    </svg>
                  </button>
                )
              })}
            </div>
            <span className="circuit-target">→ 방풍막</span>
          </div>
          <p role="status">{complete ? '회로 연결 완료' : '연결된 회로에 초록색 불이 들어와요.'}</p>
          <button className="primary-button modal-primary" disabled={!complete} onClick={onRepair}>장치 가동</button>
          <button className="text-button" onClick={() => setCircuit(onNewCircuit())}>새 회로 배치</button>
        </>
      ) : (
        <>
          <p>같은 섬에서 탐색을 이어가거나 이번 비행을 마칠 수 있어요.</p>
          <button className="primary-button modal-primary" onClick={onTakeOff}>다시 이륙</button>
          <button className="secondary-button" onClick={onFinish}>비행 마치기</button>
        </>
      )}
    </dialog>
  )
}

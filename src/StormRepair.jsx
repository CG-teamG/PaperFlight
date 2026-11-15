import { useEffect, useRef, useState } from 'react'

import { portsAt, traceCircuit } from './game/RepairCircuit.js'

const DIRECTIONS = ['위', '오른쪽', '아래', '왼쪽']
const ENDPOINTS = [[16, 0], [32, 16], [16, 32], [0, 16]]

export default function StormRepair({ repairRequired, maxSpeed, initialCircuit, onNewCircuit, onRepair, onTakeOff, onFinish }) {
  const dialog = useRef(null)
  const [showExit, setShowExit] = useState(false)
  const returnButton = useRef(null)
  const menuButton = useRef(null)
  const [circuit, setCircuit] = useState(initialCircuit)
  const { powered, complete } = traceCircuit(circuit)
  const [repairOpened] = useState(repairRequired)
  const takeOffButton = useRef(null)

  useEffect(() => {
    const modal = dialog.current
    modal.showModal()
    return () => modal.close()
  }, [])

  useEffect(() => {
    if (!repairRequired) takeOffButton.current?.focus()
  }, [repairRequired])

  useEffect(() => {
    if (showExit) returnButton.current?.focus()
    else if (!dialog.current.contains(document.activeElement)) menuButton.current?.focus()
  }, [showExit])

  return (
    <dialog ref={dialog} className="pause-modal storm-repair" aria-labelledby="repair-title"
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        if (!event.repeat) setShowExit((visible) => !visible)
      }}
      onCancel={(event) => {
        event.preventDefault()
        setShowExit((visible) => !visible)
      }}>
      {showExit ? (
        <>
          <h2 id="repair-title">착륙 메뉴</h2>
          {repairRequired && <p>복구를 이어가거나 이번 비행을 마칠 수 있어요.</p>}
          <button ref={returnButton} className="primary-button modal-primary" onClick={() => setShowExit(false)}>
            {repairRequired ? '회로 복구로 돌아가기' : '착륙 화면으로 돌아가기'}
          </button>
          <button className="secondary-button" onClick={onFinish}>비행 마치고 지도 보기</button>
        </>
      ) : (
        <>
          <h2 id="repair-title">{repairRequired ? '방재 장치 복구' : repairOpened ? '폭풍 해소' : '착륙 완료'}</h2>
          {repairRequired ? (
            <>
              <p>조각을 눌러 90°씩 돌려 왼쪽 위 전원과 오른쪽 아래 방풍막을 연결하세요.</p>
              <div className="circuit-board" role="group" aria-label="방재 장치 회로">
                <span className="circuit-source">전원 →</span>
                <div className="circuit-tiles">
                  {circuit.rotations.map((_, index) => {
                    const ports = portsAt(index, circuit)
                    return (
                      <button key={index} type="button" data-powered={powered.has(index)}
                        aria-label={(`회로 ${index + 1}${powered.has(index) ? ', 전원 연결됨' : ''}: ${ports.map((port) => DIRECTIONS[port]).join(', ')}. 90도 회전`)}
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
              <p role="status">{complete ? '회로 연결 완료. 장치를 가동하세요.' : '굵게 빛나는 선은 전원이 연결된 회로예요.'}</p>
              <button className="primary-button modal-primary" disabled={!complete} onClick={onRepair}>장치 가동</button>
              <button className="text-button" onClick={() => setCircuit(onNewCircuit())}>새 회로 배치</button>
            </>
          ) : (
            <>
              <p>같은 섬에서 탐험을 이어가요. 최대 속도 {maxSpeed + 100} u/s</p>
              <button ref={takeOffButton} className="primary-button modal-primary" onClick={onTakeOff}>다시 이륙</button>
              <button className="secondary-button" onClick={onFinish}>비행 마치고 지도 보기</button>
            </>
          )}
          <button ref={menuButton} className="text-button" onClick={() => setShowExit(true)}>착륙 메뉴 · Esc</button>
        </>
      )}
    </dialog>
  )
}

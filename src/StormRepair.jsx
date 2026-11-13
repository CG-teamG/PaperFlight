import { useEffect, useRef, useState } from 'react'

const circuits = [
  { name: '전원', hint: '배터리를 연결해 장치에 전력을 공급하세요.', symbol: '⚡' },
  { name: '감지기', hint: '안테나를 연결해 바람 방향을 확인하세요.', symbol: '⌁' },
  { name: '방풍막', hint: '방패 단자를 연결해 비상 방풍막을 가동하세요.', symbol: '◇' },
]
const terminals = [circuits[2], circuits[0], circuits[1]]

export default function StormRepair({ repairRequired, onRepair, onTakeOff, onFinish }) {
  const dialog = useRef(null)
  const [connected, setConnected] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const modal = dialog.current
    modal.showModal()
    return () => modal.close()
  }, [])

  function connect(terminal) {
    if (terminal !== circuits[connected]) {
      setFailed(true)
      return
    }
    const next = connected + 1
    setConnected(next)
    if (next === circuits.length) onRepair()
  }

  return (
    <dialog ref={dialog} className="pause-modal storm-repair" aria-labelledby="repair-title"
      onCancel={(event) => event.preventDefault()}>
      <h2 id="repair-title">{repairRequired ? '폭풍 대응 장치 복구' : '착륙 완료'}</h2>
      {repairRequired ? (
        <>
          <p>폭풍으로 끊어진 회로를 순서대로 연결하세요.</p>
          <ol className="repair-steps">
            {circuits.map(({ name }, index) => <li key={name} data-connected={index < connected}>{name}</li>)}
          </ol>
          <p role="status">
            {failed ? '회로가 차단됐어요. 다시 시도하세요.' : circuits[connected]?.hint}
          </p>
          {failed ? (
            <button className="primary-button modal-primary" onClick={() => {
              setConnected(0)
              setFailed(false)
            }}>다시 시도</button>
          ) : (
            <div className="repair-terminals">
              {terminals.map((terminal) => (
                <button key={terminal.name} className="secondary-button"
                  disabled={circuits.indexOf(terminal) < connected}
                  onClick={() => connect(terminal)}>
                  <span aria-hidden="true">{terminal.symbol}</span>
                  {terminal.name}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <p>같은 섬에서 탐색을 이어가거나 이번 비행 기록을 확인하세요.</p>
          <button className="primary-button modal-primary" onClick={onTakeOff}>다시 이륙</button>
          <button className="secondary-button" onClick={onFinish}>비행 마치기</button>
        </>
      )}
    </dialog>
  )
}

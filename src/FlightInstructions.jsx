import { useState } from 'react'

const pages = [
  { title: '종이비행기 조종', lines: [] },
  { title: '섬 탐험과 링 통과', lines: ['낮게 날아 지형을 공개하세요. 구역의 25%를 공개하면 발견으로 기록됩니다.', '링마다 첫 통과는 기본 100점이에요. 속도 보너스는 통과 순간의 속도로 계산돼요.', '추천 링은 다음에 갈 방향을 안내해요. 기본 점수는 다른 링과 같아요.'] },
  { title: '폭풍이 오면 H로 귀환', lines: ['폭풍 중에는 탐험과 링 득점이 잠시 멈춥니다.', 'H 방향과 거리를 따라 돌아가세요. 착륙장 위에서 ↓로 하강해 표면에 닿으면 복구 화면이 열립니다.'] },
  { title: '방재 장치 복구', lines: ['회로 조각을 눌러 90°씩 돌리세요.', '왼쪽 위 전원부터 오른쪽 아래 방풍막까지 연결한 뒤 장치를 가동하세요.'] },
  { title: '다시 이륙하거나 비행 종료', lines: ['다시 이륙하면 같은 섬과 탐험 기록을 이어가며 최대 속도가 100 u/s 올라갑니다.', '비행을 마치면 3D 지도와 점수, 타임라인을 볼 수 있습니다.'] },
]

export default function FlightInstructions({ dialog, controls, onContinue, continueLabel }) {
  const [page, setPage] = useState(0)
  const { title, lines } = pages[page]
  const last = page === pages.length - 1

  return (
    <dialog ref={dialog} className="pause-modal flight-instructions" aria-labelledby="flight-instructions-title"
      onClose={() => setPage(0)}>
      <header>
        <h2 id="flight-instructions-title">게임 방법</h2>
        <span>{page + 1} / {pages.length}</span>
      </header>
      <section className="instruction-page" aria-live="polite">
        <h3>{title}</h3>
        {page === 0 ? (
          <ul className="instruction-keys">
            {[...controls, { keys: ['Esc'], label: '일시정지' }].map(({ keys, label }) => (
              <li key={label}><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span>{label}</li>
            ))}
          </ul>
        ) : (
          <>
            <div className="instruction-visual" aria-hidden="true">
              {page === 1 && <><span className="instruction-ring" /><strong>+100</strong></>}
              {page === 2 && <><kbd>↓</kbd><span className="instruction-pad">H</span></>}
              {page === 3 && <div className="instruction-circuit">━ ┓ ·<br />· ┗ ┓<br />· · ┗</div>}
              {page === 4 && <><span className="instruction-pad">H</span><span>→</span><strong>+100 u/s</strong></>}
            </div>
            {lines.map((line) => <p key={line}>{line}</p>)}
          </>
        )}
      </section>
      <footer>
        <button type="button" className="secondary-button" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</button>
        <button type="button" className="primary-button" onClick={() => {
          if (!last) {
            setPage(page + 1)
            return
          }

          dialog.current.close()
          onContinue()
        }}>
          {last ? <>{continueLabel} <span aria-hidden="true">→</span></> : '다음'}
        </button>
      </footer>
    </dialog>
  )
}

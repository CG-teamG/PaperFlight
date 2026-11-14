
/*
 * ============================================================
 * 파일명: App.jsx
 * 담당자: 예빈 - 게임 UI
 * 역할: PaperFlight의 시작, 플레이, 일시정지, 결과 화면을 관리한다.
 *
 * 구현 내용:
 * 1. 게임 상태에 따라 화면을 전환한다.
 * 2. 플레이 화면에 점수, 링 통과 횟수, 탐험률을 표시한다.
 * 3. 게임 진행 시간을 표시한다.
 * 4. 실제 Three.js 환경과 연결할 수 있도록 UI를 분리한다.
 *
 * 참고:
 * 배경 환경 및 비행기 모델은 다른 팀원이 구현한다.
 * 현재 파일은 게임 UI만 담당한다.
 * ============================================================
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ExplorationMap } from './game/ExplorationMap.js'
import { HEIGHT_COLOR } from './game/FlightTrail.js'
import { EMPTY_FLIGHT_PROGRESS } from './game/FlightProgress.js'
import { createGameScene } from './game/GameScene.js'
import StormRepair from './StormRepair.jsx'
import { createCircuit } from './game/RepairCircuit.js'
import { BASE_RING_POINTS } from './game/RingSystem.js'
import './App.css'
import './MissionLayout.css'

const FLIGHT_CONTROLS = [
  { keys: ['↑', '↓'], label: '상승·하강' },
  { keys: ['←', '→'], label: '좌우 회전' },
  { keys: ['W', 'S'], label: '가속·감속' },
]
const RECOVERY_MESSAGES = {
  terrain: '지형 충돌로 최대 속도가 100 u/s로 돌아갔어요.',
  water: '수면에 닿았어요.',
}

// 초 단위 시간을 00:00 형식으로 변환
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function Logo() {
  return (
    <div className="brand">
      <div className="brand-icon">✈</div>
      <span>PAPER<span>FLIGHT</span></span>
    </div>
  )
}

// 시작 화면
function StartScreen({ onStart }) {
  const preview = useRef(null)
  useEffect(() => {
    const scene = createGameScene(THREE, preview.current, () => {}, null, null, { preview: true })
    return () => scene.dispose()
  }, [])
  return (
    <main className="start-screen">
      <div className="start-landscape" ref={preview} aria-hidden="true" />
      <section className="start-content">
        <h1>PaperFlight</h1>
        <ol className="mission-steps">
          <li><strong>섬 탐색</strong><span>낮게 날아 새 구역을 발견하고, 링을 통과해 점수를 얻으세요.</span></li>
          <li><strong>비상 귀환</strong><span>폭풍이 오면 화면의 H 표시를 따라 착륙하세요.</span></li>
          <li><strong>방재 장치 복구</strong><span>회로를 연결하고 다시 이륙하거나 비행을 마치세요.</span></li>
        </ol>
        <button className="primary-button start-button" onClick={onStart}>
          비행 시작하기
          <span>→</span>
        </button>

        <div className="start-hint">
          {FLIGHT_CONTROLS.map(({ keys, label }) => (
            <span className="start-control" key={label}>
              {keys.map((key) => <kbd key={key}>{key}</kbd>)} {label}
            </span>
          ))}
        </div>
      </section>
    </main>
  )
}

// 게임 플레이 화면
function PlayingScreen({ progress, sceneContainer, ringDirection, onPause, isPaused }) {
  const {
    score, passedRings, totalRings,
    award, speed, maxSpeed = 100, recoveries, outsideSurveyArea,
    elapsed, guidance, recoveryReason, storm,
  } = progress
  const [showControls, setShowControls] = useState(true)
  const discovery = progress.discovery
  useEffect(() => {
    if (!showControls) return
    const timer = setTimeout(() => setShowControls(false), 12000)
    return () => clearTimeout(timer)
  }, [showControls])

  return (
    <main className="game-screen" data-storm={storm}>
      <div className="flight-scene" ref={sceneContainer} />
      {storm && <div className="storm-alert-edge" data-paused={isPaused} aria-hidden="true" />}
      {/* 상단 UI */}
      <header className="game-header">
        <Logo />

        <div className={`flight-status ${isPaused ? 'paused' : ''}`}>
          <span className="status-dot" />
          <time aria-label="비행 시간">{formatTime(elapsed)}</time>
        </div>

        <div className="flight-header-actions">
          <button className="pause-button" onClick={onPause}>
            <span className="pause-icon" aria-hidden="true">Ⅱ</span>
            <span>일시정지</span> <kbd>Esc</kbd>
          </button>
          <div className="flight-ring-score">
            <span>링 점수</span>
            <strong>{score.toLocaleString()}</strong>
            {award && !storm && <span className="score-award" key={passedRings}>+{award.points}점{award.bonus > 0 && <small>속도 보너스 +{award.bonus}</small>}</span>}
          </div>
          <small className="ring-tally">통과한 링 {passedRings}/{totalRings}</small>
        </div>
      </header>

      {storm && <div className="storm-forecast emergency-status" data-active={!isPaused} role="status">
        <strong>비상 착륙</strong> <span className="emergency-instruction">H 착륙장으로 즉시 귀환</span>
      </div>}
      <aside className="hud-panel exploration-panel" aria-label="비행 계기">
        <dl className="flight-telemetry">
          <div><dt>현재 속도</dt><dd>{Math.floor(speed)} <small>u/s</small></dd></div>
          <div><dt>최대 속도</dt><dd>{maxSpeed} <small>u/s</small></dd></div>
        </dl>
        {storm && <p className="survey-status">탐험·득점 일시 중지</p>}
      </aside>
      {!storm && outsideSurveyArea && <div className="survey-boundary" role="status">섬에서 멀어지고 있어요</div>}
      {!storm && discovery && elapsed - discovery.time < 3 && (
        <div className="discovery-toast" role="status">새 구역 발견{discovery.name && ' · ' + discovery.name}</div>
      )}

      <div className={`ring-direction${storm ? ' landing-direction' : ''}`} ref={ringDirection} hidden>
        <span className="ring-direction-arrow" aria-hidden="true">↑</span>
        {storm && guidance && <div className="guide-details">
          <strong>H 착륙장</strong>
          <span>{Math.round(guidance.distance).toLocaleString()} u</span>
        </div>}
      </div>
      {!storm && progress.nearLanding && <div className="landing-tip">
        H 착륙장 위에서 ↓로 하강
      </div>}

      <div className="ring-feedback" role="status" aria-atomic="true">
        {recoveries > 0 && (
          <div className="ring-feedback-card recovery-feedback" key={`recovery-${recoveries}`}>
            <strong>{storm ? '안전 고도에서 귀환 재시도' : '출발 지점으로 복귀'}</strong>
            <span>{RECOVERY_MESSAGES[recoveryReason]} 탐험 기록은 유지돼요.</span>
          </div>
        )}

      </div>

      {/* 하단 조작 안내 */}
      {showControls && !storm && <footer className="game-footer">
        <div className="control-guide">
          {FLIGHT_CONTROLS.map(({ keys, label }) => (
            <div className="control-item" key={label}>
              <span className="control-keys">
                {keys.map((key) => <kbd className="key" key={key}>{key}</kbd>)}
              </span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </footer>}
    </main>
  )
}

// 일시정지 팝업
function PauseScreen({ onResume, onRestart, onHome, onFinish, storm }) {
  const modal = useRef(null)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    const dialog = modal.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  return (
    <dialog
      className="pause-modal"
      ref={modal}
      aria-labelledby="pause-title"
      onCancel={(event) => {
        event.preventDefault()
        if (confirmAction) setConfirmAction(null)
        else onResume()
      }}
    >
      <h2 id="pause-title">{confirmAction ? '현재 비행 기록을 지울까요?' : '비행 일시정지'}</h2>
      {confirmAction ? <>
        <button className="primary-button modal-primary" onClick={() => setConfirmAction(null)}>돌아가기</button>
        <button className="secondary-button" onClick={confirmAction === 'restart' ? onRestart : onHome}>
          {confirmAction === 'restart' ? '기록 지우고 다시 시작' : '기록 지우고 메인으로'}
        </button>
      </> : <>
        <p className="score-rules">{storm ? 'H 착륙장으로 귀환하세요.' : `링 기본 ${BASE_RING_POINTS}점 · 통과 속도에 따라 보너스`}</p>
        <p className="pause-controls">↑↓ 고도 · ←→ 회전 · W 가속 · S 감속</p>
        <button className="primary-button modal-primary" onClick={onResume}>{storm ? '비상 귀환 재개' : '비행 재개'}</button>
        {!storm && <button className="secondary-button" onClick={onFinish}>비행 마치고 결과 보기</button>}
        <div className="pause-exits">
          <button className="text-button" onClick={() => setConfirmAction('restart')}>처음부터 다시 시작</button>
          <button className="text-button" onClick={() => setConfirmAction('home')}>메인 화면으로</button>
        </div>
      </>}
    </dialog>
  )
}

const FLIGHT_EVENTS = {
  storm: { label: '폭풍 발생', color: '#ffa444' },
  landing: { label: 'H 착륙', color: '#75eb9c' },
  repair: { label: '복구 완료', color: '#ffe182' },
  takeoff: { label: '재이륙', color: '#86d9ff' },
  recovery: { label: '충돌 후 복귀', color: '#ff8d9b' },
}

function FlightTimeline({ events, elapsed }) {
  const types = Object.entries(FLIGHT_EVENTS).filter(([type]) => events.some((event) => event.type === type))

  return (
    <section className="flight-timeline" aria-label="비행 타임라인">
      <h2>비행 타임라인</h2>
      <div className="flight-timeline-axis">
        <span>00:00</span><span>{formatTime(elapsed)}</span>
        {events.map((event, index) => (
          <i key={index} role="img" aria-label={formatTime(event.time) + ' ' + FLIGHT_EVENTS[event.type].label}
            style={{
              left: Math.min(100, event.time / Math.max(1, elapsed) * 100) + '%',
              backgroundColor: FLIGHT_EVENTS[event.type].color,
              '--event-row': Object.keys(FLIGHT_EVENTS).indexOf(event.type),
            }} />
        ))}
      </div>
      {types.length > 0 && <ul className="timeline-legend" aria-label="타임라인 색상 범례">
        {types.map(([type, { label, color }]) => <li key={type}><i style={{ backgroundColor: color }} />{label}</li>)}
      </ul>}
    </section>
  )
}

function ResultMap({ island, zones, path, routeEvents, distance, elapsed }) {
  const container = useRef(null)
  useEffect(() => {
    if (!island) return
    const map = new ExplorationMap(THREE, OrbitControls, container.current, { ...island, zones }, path)
    return () => map.dispose()
  }, [island, zones, path])
  return (
    <>
      <div className="flight-route-heading"><strong>전체 비행 경로</strong><span>이동 거리 {Math.round(distance).toLocaleString()} u</span></div>
      <div className="result-map-3d" ref={container} aria-label="3D 비행 경로 지도" />
      <FlightTimeline events={routeEvents ?? []} elapsed={elapsed} />
      <div className="map-legend">
        <div className="map-altitude">
          <span>낮은 고도</span>
          <span className="altitude-ramp" style={{
            '--altitude-low': '#' + HEIGHT_COLOR.low.toString(16).padStart(6, '0'),
            '--altitude-high': '#' + HEIGHT_COLOR.high.toString(16).padStart(6, '0'),
          }} aria-hidden="true" />
          <span>높은 고도</span>
        </div>
        <ul aria-label="지도 범례">
          <li>출발 깃발</li>
          <li>H 착륙장</li>
          <li>초록 링 · 통과</li>
          <li>회색 링 · 미통과</li>
        </ul>
      </div>
      <p className="result-map-help">드래그로 회전 · 휠로 확대/축소</p>
    </>
  )
}

// 결과 화면
function ResultScreen({ progress, onRestart, onHome }) {
  const {
    score, ringPoints, landingPoints, passedRings, island, resultIsland, zones = [], exploration = 0, distance, stormsResolved, routeEvents,
    path, recoveries, outcome, elapsed,
  } = progress
  const discoveryCount = zones.filter(({ discovered }) => discovered).length
  const totalRegions = zones.length
  const missionComplete = outcome === 'landed'
  const earlyLanding = outcome === 'early-landing'

  return (
    <main className="result-screen">
      <div className="result-content">
        <div className="result-eyebrow">
          <span />
          {missionComplete || earlyLanding ? '종료 사유 · 목표 위치 착륙' : '종료 사유 · 직접 종료'}
          <span />
        </div>

        <h1>{missionComplete ? '비행 기록' : earlyLanding ? '안전하게 귀환했어요' : '비행 기록'}</h1>
        <p className="result-note">
          {missionComplete
            ? 'H에서 비행을 마쳤어요.'
            : earlyLanding
              ? '이번 비행에서 발견한 구역과 비행 경로를 확인하세요.'
              : '자유 비행을 마쳤어요. 이번 조사 기록을 확인해 보세요.'}
        </p>

        <div className="result-grid">
          <section className="result-score-card">
            <span className="result-card-label">총점</span>

            <div className="result-score">
              {score.toLocaleString()}
              <span>점</span>
            </div>

            <dl className="result-score-breakdown">
              <div><dt>링 통과 점수</dt><dd>{ringPoints.toLocaleString()}점</dd></div>
              <div><dt>착륙 보너스</dt><dd>{landingPoints.toLocaleString()}점</dd></div>
                <div><dt>해결한 폭풍</dt><dd>{stormsResolved ?? 0}회</dd></div>
            </dl>

            <div className="result-divider" />

            <div className="result-stats">
              <div>
                <span>링 통과</span>
                <strong>{passedRings}<small>개</small></strong>
              </div>

              <div>
                <span>탐험률 {exploration}%</span>
                <strong>{discoveryCount}<small> / {totalRegions}</small></strong>
              </div>

              <div>
                <span>비행 시간</span>
                <strong>{formatTime(elapsed)}</strong>
              </div>
              <div>
                <span>복귀</span>
                <strong>{recoveries}<small>회</small></strong>
              </div>
            </div>
          </section>
          <section className="result-map-card">
            <ResultMap island={resultIsland ?? island} zones={zones} path={path} routeEvents={routeEvents} distance={distance} elapsed={elapsed} />
          </section>
        </div>

        <div className="result-actions">
          <button className="primary-button" onClick={onRestart}>
            다시 비행하기 <span>→</span>
          </button>

          <button className="secondary-button" onClick={onHome}>
            메인 화면으로
          </button>
        </div>
      </div>
    </main>
  )
}

// 전체 앱
function App() {
  const [flightId, setFlightId] = useState(0)
  const [gameState, setGameState] = useState('start')
  const [progress, setProgress] = useState(EMPTY_FLIGHT_PROGRESS)
  const sceneContainer = useRef(null)
  const ringDirection = useRef(null)
  const scene = useRef(null)
  const lastCircuit = useRef(null)
  const [dockedCircuit, setDockedCircuit] = useState(null)
  const isPaused = gameState === 'paused'
  const docked = gameState === 'docked'
  const inFlight = gameState === 'playing' || isPaused || docked

  useEffect(() => {
    if (!inFlight) return

    const gameScene = createGameScene(
      THREE, sceneContainer.current, setProgress, ringDirection.current, () => {
        lastCircuit.current = createCircuit(lastCircuit.current)
        setDockedCircuit(lastCircuit.current)
        setGameState('docked')
      },
    )
    scene.current = gameScene
    return () => {
      scene.current = null
      gameScene.dispose()
    }
  }, [inFlight, flightId])

  useEffect(() => {
    scene.current?.setPaused(isPaused || docked)
  }, [isPaused, docked, flightId])

  useEffect(() => {
    if (gameState !== 'playing') return

    const pauseWhenHidden = () => {
      if (document.hidden) setGameState('paused')
    }
    const pauseOnEscape = (event) => {
      if (event.key !== 'Escape' || event.repeat) return
      event.preventDefault()
      setGameState('paused')
    }
    window.addEventListener('keydown', pauseOnEscape)
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => {
      window.removeEventListener('keydown', pauseOnEscape)
      document.removeEventListener('visibilitychange', pauseWhenHidden)
    }
  }, [gameState])

  // 게임 시작
  const startGame = () => {
    setProgress(EMPTY_FLIGHT_PROGRESS)
    setGameState('playing')
  }

  // 게임 재시작
  const restartGame = () => {
    startGame()
    setFlightId((id) => id + 1)
  }

  // 메인 화면으로 이동
  const goHome = () => {
    setGameState('start')
  }

  return (
    <div className="app">
      {gameState === 'start' && (
        <StartScreen onStart={startGame} />
      )}

      {inFlight && (
        <PlayingScreen
          key={flightId}
          progress={progress}
          sceneContainer={sceneContainer}
          ringDirection={ringDirection}
          isPaused={isPaused || docked}
          onPause={() => setGameState('paused')}
        />
      )}

      {docked && (
        <StormRepair
          repairRequired={progress.storm}
          maxSpeed={progress.maxSpeed ?? 100}
          initialCircuit={dockedCircuit}
          onNewCircuit={() => {
            lastCircuit.current = createCircuit(lastCircuit.current)
            return lastCircuit.current
          }}
          onRepair={() => scene.current?.resolveStorm()}
          onTakeOff={() => {
            scene.current?.takeOff()
            setGameState('playing')
          }}
          onFinish={() => setGameState('result')}
        />
      )}

      {isPaused && (
        <PauseScreen storm={progress.storm}
          onFinish={() => { if (scene.current?.finish()) setGameState('result') }}
          onResume={() => setGameState('playing')}
          onRestart={restartGame}
          onHome={goHome}
        />
      )}

      {gameState === 'result' && (
        <ResultScreen
          progress={progress}
          onRestart={restartGame}
          onHome={goHome}
        />
      )}
    </div>
  )
}

export default App

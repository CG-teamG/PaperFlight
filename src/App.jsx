
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
import { ACTIVE_RING_COLOR } from './game/Environment.js'
import { EMPTY_FLIGHT_PROGRESS } from './game/FlightProgress.js'
import { EMERGENCY_LANDING_HEIGHT, EMERGENCY_LANDING_RADIUS, LANDING_MAX_SPEED } from './game/FlightRules.js'
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
  terrain: '지형이나 수면에 닿았어요.',
  speed: `착륙할 때는 ${LANDING_MAX_SPEED} u/s 이하로 감속하세요.`,
  angle: '착륙장에는 더 완만한 각도로 접근하세요.',
  'pad-edge': '착륙장 중앙을 향해 위에서 내려오세요.',
}

// 초 단위 시간을 00:00 형식으로 변환
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function FlightMap({ island, path, heading, target, elapsed, landingZone, zones }) {
  const container = useRef(null)
  const map = useRef(null)
  useEffect(() => {
    if (!island) return
    const instance = new ExplorationMap(THREE, OrbitControls, container.current,
      { ...island, activeRingColor: ACTIVE_RING_COLOR }, [], { live: true })
    map.current = instance
    return () => {
      instance.dispose()
      map.current = null
    }
  }, [island])
  useEffect(() => {
    if (path) map.current?.updateFlight(path, heading, target, elapsed, landingZone, zones)
  }, [island, path, heading, target, elapsed, landingZone, zones])
  return <div className="live-map-3d" ref={container} />
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
  return (
    <main className="start-screen">
      <section className="start-content">
        <h1>PaperFlight</h1>
        <ol className="mission-steps">
          <li><strong>섬 탐색</strong><span>낮고 천천히 날아 지도를 밝히고, 링을 통과해 점수를 얻으세요.</span></li>
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
function PlayingScreen({ progress, sceneContainer, ringDirection, onPause, onToggleLandingGuide, isPaused }) {
  const {
    score, passedRings, totalRings,
    island, zones = [], award, speed, maxSpeed = 100, path, recoveries, landingPad,
    elapsed, guidance, recoveryReason, storm, autoLanding, stormCountdown, heading,
  } = progress
  const allRingsPassed = totalRings > 0 && passedRings === totalRings
  const discoveryCount = zones.filter(({ discovered }) => discovered).length
  const stormApproaching = stormCountdown != null && stormCountdown <= 10
  const guidingLanding = guidance?.kind === 'landing'

  return (
    <main className="game-screen" data-storm={storm}>
      <div className="flight-scene" ref={sceneContainer} />
      {storm && <div className="storm-alert-edge" data-paused={isPaused || autoLanding} aria-hidden="true" />}
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
            <span aria-label="링 점수">score</span>
            <strong>{score.toLocaleString()}</strong>
            {award && !storm && <span className="score-award" key={passedRings}>+{award.points}점</span>}
          </div>
          <small className="ring-tally">통과한 링 {passedRings}/{totalRings}</small>
        </div>
      </header>

      {stormApproaching && (
        <div className="storm-forecast" role="status">
          <strong>폭풍 접근</strong>
          <span aria-live="off">{stormCountdown}초 후 폭풍 도달</span>
        </div>
      )}

      {/* 좌측 탐험 정보 */}
      <aside className="hud-panel exploration-panel">
        <dl className="flight-telemetry" aria-label="비행 계기">
          <div><dt>속도</dt><dd>{Math.floor(speed)} <small>/ {maxSpeed} u/s</small></dd></div>
        </dl>
        <div className="discovery-readout">
          <strong><small>발견 구역 </small>{discoveryCount}<small>개</small></strong>
        </div>

        <div className="flight-objective">
          {storm ? (
            <div role="status">
              <strong>{autoLanding ? '자동 착륙 중' : 'H 착륙장으로 귀환'}</strong>
              <div>탐험 기록·링 점수 집계 일시 중지</div>
            </div>
          ) : guidingLanding ? (
            <span>H에서 {LANDING_MAX_SPEED} u/s 이하로 완만하게 하강하세요.</span>
          ) : null}
          {landingPad && !allRingsPassed && !storm && (
            <button className="landing-guide-button" aria-pressed={guidingLanding} onClick={onToggleLandingGuide}>
              H 착륙장 안내
            </button>
          )}
        </div>
      </aside>

      <aside className="flight-map" aria-label="탐험 지도">
        <FlightMap island={island} path={path} heading={heading} elapsed={progress.mapTime} landingZone={storm || stormApproaching} zones={zones}
          target={guidance?.kind === 'ring' ? guidance.position : null} />
      </aside>

      <div className={`ring-direction${guidingLanding ? ' landing-direction' : ''}`} ref={ringDirection} hidden>
        <span className="ring-direction-arrow" aria-hidden="true">↑</span>
        <span className="guide-in-view" aria-hidden="true">H</span>
        <div className="guide-details">
          <strong>H 착륙장</strong>
          {guidance && <span>{Math.round(guidance.distance).toLocaleString()} u</span>}
          {autoLanding && <span role="status">자동 착륙 중 · 조종 입력 잠김</span>}
          {storm && !autoLanding && guidance && (
            <>
              <span>H 기준 고도 {guidance.altitude} u</span>
              <span className="guide-warning">
                <span className="return-turn return-turn-left">← 좌회전</span>
                <span className="return-turn return-turn-right">우회전 →</span>
                <span className="return-approach">
                  {guidance.distance > EMERGENCY_LANDING_RADIUS ? '고도를 유지하며 접근' :
                    guidance.altitude > EMERGENCY_LANDING_HEIGHT ? '↓ ' + EMERGENCY_LANDING_HEIGHT + ' u 이하로 하강' :
                      guidance.altitude <= 1 ? '↑ 고도를 조금 높이세요' : '자동 착륙 접근 중'}
                </span>
              </span>
            </>
          )}
          {guidingLanding && !storm && (
            <span className={speed > LANDING_MAX_SPEED ? 'guide-warning' : ''}>
              {speed > LANDING_MAX_SPEED ? 'S로 감속' : `착륙장 기준 고도 ${guidance.altitude} u`}
            </span>
          )}
        </div>
      </div>

      <div className="ring-feedback" role="status" aria-atomic="true">
        {recoveries > 0 && (
          <div className="ring-feedback-card recovery-feedback" key={`recovery-${recoveries}`}>
            <strong>{storm ? '안전 고도에서 귀환 재시도' : '출발 지점으로 복귀'}</strong>
            <span>{RECOVERY_MESSAGES[recoveryReason]} 탐험 기록은 유지돼요.</span>
          </div>
        )}

      </div>

      {/* 하단 조작 안내 */}
      <footer className="game-footer">
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
      </footer>
    </main>
  )
}

// 일시정지 팝업
function PauseScreen({ onResume, onRestart, onHome, onFinish, storm }) {
  const modal = useRef(null)

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
        onResume()
      }}
    >
      <h2 id="pause-title">비행 일시정지</h2>
      <p className="score-rules">
        {storm ? '비행을 재개하고 H 착륙장으로 귀환하세요.' : `링을 통과하면 ${BASE_RING_POINTS}점을 얻어요.`}
      </p>

      <button className="primary-button modal-primary" onClick={onResume}>
        이어서 비행하기 <span>→</span>
      </button>

      {!storm && <button className="secondary-button" onClick={onFinish}>비행 마치고 결과 보기</button>}

      <button className="secondary-button" onClick={() => { if (window.confirm('현재 비행 기록을 지우고 새로 시작할까요?')) onRestart() }}>
        처음부터 다시 시작
      </button>

      <button className="text-button" onClick={() => { if (window.confirm('현재 비행 기록을 지우고 메인 화면으로 돌아갈까요?')) onHome() }}>
        메인 화면으로 돌아가기
      </button>
    </dialog>
  )
}

const EVENT_NAMES = { storm: '폭풍 발생', landing: 'H 착륙', repair: '복구 완료', takeoff: '재이륙' }

function FlightTimeline({ events, elapsed, onFocus }) {
  return (
    <section className="flight-timeline" aria-label="비행 타임라인">
      <h2>비행 타임라인</h2>
      <div className="flight-timeline-axis" aria-hidden="true">
        <span>00:00</span><span>{formatTime(elapsed)}</span>
        {events.map((event, index) => (
          <i key={index} data-event={event.type} style={{ left: (event.time / Math.max(1, elapsed)) * 100 + '%' }} />
        ))}
      </div>
      {events.length > 0 && (
        <ol className="flight-events">
          {events.map((event, index) => (
            <li key={index}><button className="secondary-button" data-event={event.type} onClick={() => onFocus(event)}>
              <time>{formatTime(event.time)}</time> {EVENT_NAMES[event.type]}
            </button></li>
          ))}
        </ol>
      )}
    </section>
  )
}

function ResultMap({ island, zones, path, routeEvents, distance, elapsed }) {
  const container = useRef(null)
  const resultMap = useRef(null)
  useEffect(() => {
    if (!island) return
    const map = new ExplorationMap(THREE, OrbitControls, container.current, { ...island, zones, routeEvents }, path)
    resultMap.current = map
    return () => { map.dispose(); resultMap.current = null }
  }, [island, zones, path, routeEvents])
  return (
    <>
      <div className="flight-route-heading"><strong>전체 비행 경로</strong><span>이동 거리 {Math.round(distance).toLocaleString()} u</span></div>
      <div className="result-map-3d" ref={container} aria-label="3D 비행 경로 지도" />
      <FlightTimeline events={routeEvents ?? []} elapsed={elapsed} onFocus={(event) => resultMap.current?.focusEvent(event)} />
      <div className="map-legend">
        <div className="map-altitude">
          <span>낮은 고도</span>
          <span className="altitude-ramp" style={{
            '--altitude-low': '#' + HEIGHT_COLOR.low.toString(16).padStart(6, '0'),
            '--altitude-high': '#' + HEIGHT_COLOR.high.toString(16).padStart(6, '0'),
          }} aria-hidden="true" />
          <span>높은 고도</span>
        </div>
        <ul aria-label="지도 사건 표식">
          <li><i className="map-event-storm" />폭풍 발생</li>
          <li><i className="map-event-landing" />H 착륙</li>
        </ul>
      </div>
      <p className="result-map-help">드래그로 회전 · 휠로 확대/축소</p>
    </>
  )
}

// 결과 화면
function ResultScreen({ progress, onRestart, onHome }) {
  const {
    score, passedRings, island, resultIsland, zones = [], distance, stormsResolved, routeEvents,
    path, recoveries, outcome, elapsed,
  } = progress
  const discoveryCount = zones.filter(({ discovered }) => discovered).length
  const landed = outcome === 'landed' || outcome === 'early-landing'

  return (
    <main className="result-screen">
      <div className="result-content">
        <div className="result-eyebrow">
          <span />
          {landed ? 'H 착륙장에서 종료' : '비행 중 종료'}
          <span />
        </div>

        <h1>비행 기록</h1>

        <div className="result-grid">
          <section className="result-map-card">
            <ResultMap island={resultIsland ?? island} zones={zones} path={path} routeEvents={routeEvents} distance={distance} elapsed={elapsed} />
          </section>
          <section className="result-score-card" aria-label="비행 요약">
            <dl className="record-stats">
              <div><dt>발견 구역</dt><dd>{discoveryCount}개</dd></div>
              <div><dt>비행 시간</dt><dd>{formatTime(elapsed)}</dd></div>
              <div><dt>링 점수</dt><dd>{score.toLocaleString()}점 <small>· {passedRings}개 통과</small></dd></div>
              <div><dt>해결한 폭풍</dt><dd>{stormsResolved ?? 0}회</dd></div>
              {recoveries > 0 && <div><dt>충돌 후 복귀</dt><dd>{recoveries}회</dd></div>}
            </dl>
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
          progress={progress}
          sceneContainer={sceneContainer}
          ringDirection={ringDirection}
          isPaused={isPaused || docked}
          onPause={() => setGameState('paused')}
          onToggleLandingGuide={() => scene.current?.setLandingGuide(progress.guidance?.kind !== 'landing')}
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

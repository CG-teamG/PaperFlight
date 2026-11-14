
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
import { ACTIVE_RING_COLOR, MAP_SIZE } from './game/Environment.js'
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

function FlightRoute({ path, distance, island, reveal, landingPad, recommendedRing, heading, routeEvents = [], showLegend = false }) {
  const halfMap = MAP_SIZE / 2
  const mapPoints = [...path, ...routeEvents]
  const xs = mapPoints.map(({ x }) => x)
  const zs = mapPoints.map(({ z }) => z)
  const left = Math.min(-halfMap, ...xs)
  const right = Math.max(halfMap, ...xs)
  const top = Math.min(-halfMap, ...zs)
  const bottom = Math.max(halfMap, ...zs)
  const width = right - left
  const height = bottom - top
  const radius = Math.max(width, height) * 0.014
  const padding = radius * 2
  const start = path[0]
  const end = path.at(-1)
  const route = path.map(({ x, z, breakBefore }, index) => `${index === 0 || breakBefore ? 'M' : 'L'}${x},${z}`).join(' ')

  return (
    <div className="flight-route">
      {showLegend && (
        <div className="flight-route-heading">
          <span>전체 비행 경로</span>
          <strong>{Math.round(distance).toLocaleString()} <small>u</small></strong>
        </div>
      )}
      <svg
        className="flight-route-map"
        viewBox={`${left - padding} ${top - padding} ${width + padding * 2} ${height + padding * 2}`}
        role="img"
        aria-label="발견 지역과 비행 경로, H 착륙장 지도"
      >
        {island && reveal && Array.from({ length: 32 * 32 }, (_, index) => {
          const u = (index % 32 + .5) / 32
          const v = (Math.floor(index / 32) + .5) / 32
          const sample = Math.round(v * (island.grid - 1)) * island.grid + Math.round(u * (island.grid - 1))
          if (island.heights[sample] <= 0) return null
          const seen = reveal.data[Math.floor(v * reveal.size) * reveal.size + Math.floor(u * reveal.size)]
          const step = island.mapSize / 32
          return <rect key={index} x={index % 32 * step - halfMap} y={Math.floor(index / 32) * step - halfMap}
            width={step + .1} height={step + .1} fill={seen >= .5 ? '#66aa76' : '#68757f'} />
        })}
        <path className="flight-route-line" d={route} />
        {recommendedRing && (
          <g className="recommended-map-target" style={{ color: ACTIVE_RING_COLOR }}>
            <title>추천 링</title>
            <circle className="recommended-map-halo" cx={recommendedRing.x} cy={recommendedRing.z} r={radius * 2.1} />
            <circle className="recommended-map-marker" cx={recommendedRing.x} cy={recommendedRing.z} r={radius * 1.5} />
          </g>
        )}
        {landingPad && (
          <g className="landing-map-marker">
            <circle cx={landingPad.x} cy={landingPad.z} r={radius * 3.5} />
            <text x={landingPad.x} y={landingPad.z} fontSize={radius * 5}>H</text>
          </g>
        )}
        {start && <circle className="flight-route-start" cx={start.x} cy={start.z} r={radius} />}
        {heading == null && end && <circle className="flight-route-end" cx={end.x} cy={end.z} r={radius * 1.25} />}
        {heading != null && end && (
          <path className="map-aircraft" d={`M0,${-radius * 2} L${radius},${radius} 0,${radius * .5} ${-radius},${radius} Z`}
            transform={`translate(${end.x} ${end.z}) rotate(${heading})`}>
            <title>현재 위치와 기수 방향</title>
          </path>
        )}
        {showLegend && routeEvents.map(({ type, x, z }, index) => (
          <text key={index} x={x} y={z} dy={type === 'landing' ? -radius : 0}
            fontSize={radius * 2.8} className={`route-event route-event-${type}`}>
            <title>{type === 'storm' ? '폭풍 발생' : 'H 착륙'}</title>
            {type === 'storm' ? '!' : 'H'}
          </text>
        ))}
      </svg>
      {showLegend && (
        <ul className="flight-route-legend">
          <li><span className="route-legend-start" />출발</li>
          <li><span className="route-legend-end" />도착</li>
          {landingPad && <li><span className="route-legend-landing" />착륙장</li>}
          {routeEvents.some(({ type }) => type === 'storm') && <li>! 폭풍 발생</li>}
          {routeEvents.some(({ type }) => type === 'landing') && <li>H 착륙 기록</li>}
        </ul>
      )}
    </div>
  )
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
          <li><strong>섬 탐색</strong><span>비행한 곳의 지형이 드러나고 링을 통과하면 점수를 얻어요.</span></li>
          <li><strong>비상 귀환</strong><span>폭풍이 오면 H 착륙장으로 돌아오세요.</span></li>
          <li><strong>방재 장치 복구</strong><span>회로를 연결하고 다시 이륙하거나 비행을 마치세요.</span></li>
        </ol>
        <button className="primary-button start-button" onClick={onStart}>
          비행 시작하기
          <span>→</span>
        </button>

        <div className="start-hint">
          <span className="hint-dot" />
          방향키로 조종 · W/S로 속도 조절
        </div>
      </section>
    </main>
  )
}

// 게임 플레이 화면
function PlayingScreen({ progress, sceneContainer, ringDirection, onPause, onFinish, onToggleLandingGuide, isPaused }) {
  const {
    score, passedRings, totalRings,
    island, reveal, zones = [], exploration = 0, award, speed, distance, path, recoveries, landingPad,
    elapsed, guidance, recoveryReason, outsideSurveyArea, storm, autoLanding, stormCountdown, heading,
  } = progress
  const allRingsPassed = totalRings > 0 && passedRings === totalRings
  const discoveryCount = zones.filter(({ discovered }) => discovered).length
  const totalRegions = zones.length
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
            <span>일시정지</span>
          </button>
          <div className="flight-ring-score">
            <span>score</span>
            <strong>{score.toLocaleString()}</strong>
          </div>
        </div>
      </header>

      {stormApproaching && (
        <div className="storm-forecast" role="status">
          <strong>폭풍 접근</strong>
          <span aria-live="off">{stormCountdown}초 후 비상 귀환</span>
        </div>
      )}

      {/* 좌측 탐험 정보 */}
      <aside className="hud-panel exploration-panel">
        <dl className="flight-telemetry" aria-label="비행 계기">
          <div><dt>속도</dt><dd>{Math.floor(speed)} <small>u/s</small></dd></div>
          <div><dt>링</dt><dd>{passedRings}/{totalRings}</dd></div>
        </dl>
        <div className="discovery-readout">
          <span>탐험률 {exploration}%</span>
          <strong>{discoveryCount}<small> / {totalRegions}</small></strong>
        </div>

        <div
          className="progress-track" role="progressbar" aria-label="탐험률"
          aria-valuenow={exploration} aria-valuemax={100}
        >
          <div
            className="progress-fill"
            style={{ width: `${exploration}%` }}
          />
        </div>

        <div className="flight-objective">
          {storm ? (
            <div role="status">
              <strong>폭풍 경보 · H로 비상 귀환</strong>


              <div>발견·링 점수 집계 중지</div>
            </div>
          ) : guidingLanding ? (
            <span>H에서 {LANDING_MAX_SPEED} u/s 이하로 완만하게 하강하세요.</span>
          ) : null}
          {landingPad && !allRingsPassed && !storm && (
            <button className="landing-guide-button" onClick={onToggleLandingGuide}>
              {guidingLanding ? '추천 링 안내' : 'H 착륙장 안내'}
            </button>
          )}
        </div>
      </aside>

      <aside className="flight-map" aria-label="탐험 지도">
        <FlightRoute
          path={path} distance={distance} island={island} reveal={reveal} landingPad={landingPad}
          heading={heading}
          recommendedRing={guidance?.kind === 'ring' ? guidance.position : null}
        />
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
        {outsideSurveyArea && <div className="boundary-feedback">조사 구역 밖이에요. 지도의 추천 링이나 H로 돌아오세요.</div>}
        {recoveries > 0 && (
          <div className="ring-feedback-card recovery-feedback" key={`recovery-${recoveries}`}>
            <strong>출발 지점으로 복귀</strong>
            <span>{RECOVERY_MESSAGES[recoveryReason]} 조사 기록은 유지돼요.</span>
          </div>
        )}
        {award && !storm && (
          <div className="ring-feedback-card" key={passedRings}>
            <strong>+{award.points}점</strong>
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

        <button className="finish-button" onClick={onFinish} disabled={storm}>
          비행 종료 →
        </button>
      </footer>
    </main>
  )
}

// 일시정지 팝업
function PauseScreen({ onResume, onRestart, onHome, storm }) {
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
      <div className="modal-eyebrow">FLIGHT PAUSED</div>
      <h2 id="pause-title">비행 일시정지</h2>
      <p className="score-rules">
        링 통과 {BASE_RING_POINTS}점
      </p>

      <button className="primary-button modal-primary" onClick={onResume}>
        이어서 비행하기 <span>→</span>
      </button>

      <button className="secondary-button" onClick={onRestart} disabled={storm}>
        처음부터 다시 시작
      </button>

      <button className="text-button" onClick={onHome} disabled={storm}>
        메인 화면으로 돌아가기
      </button>
    </dialog>
  )
}

function ResultMap({ island, reveal, path, routeEvents, distance }) {
  const container = useRef(null)
  useEffect(() => {
    if (!island || !reveal) return
    const map = new ExplorationMap(THREE, OrbitControls, container.current, { ...island, reveal, routeEvents }, path)
    return () => map.dispose()
  }, [island, reveal, path, routeEvents])
  return (
    <>
      <div className="flight-route-heading"><strong>전체 비행 경로</strong><span>{Math.round(distance).toLocaleString()} u</span></div>
      <div className="result-map-3d" ref={container} aria-label="3D 비행 경로 지도" />
      <p className="result-map-help">드래그 회전 · 휠 확대/축소 · 경로 색은 고도 · 주황 폭풍 · 초록 착륙</p>
    </>
  )
}

// 결과 화면
function ResultScreen({ progress, onRestart, onHome }) {
  const {
    score, ringPoints, passedRings, island, reveal, zones = [], exploration = 0, distance, stormsResolved, routeEvents,
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
            <span className="result-card-label">링 점수</span>

            <div className="result-score">
              {score.toLocaleString()}
              <span>점</span>
            </div>

            <dl className="result-score-breakdown">
              <div><dt>링 통과 점수</dt><dd>{ringPoints.toLocaleString()}점</dd></div>
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
            <ResultMap island={island} reveal={reveal} path={path} routeEvents={routeEvents} distance={distance} />
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
          onFinish={() => {
            if (scene.current?.finish()) setGameState('result')
          }}
        />
      )}

      {docked && (
        <StormRepair
          repairRequired={progress.storm}
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

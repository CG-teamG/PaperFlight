
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
import StormRepair from './StormRepair.jsx'
import { getTerrainMap, MAP_SIZE } from './game/Environment.js'
import { MAX_FLIGHT_SPEED } from './game/FlightController.js'
import { EMPTY_FLIGHT_PROGRESS, LANDING_BONUS_POINTS } from './game/FlightProgress.js'
import { EMERGENCY_LANDING_HEIGHT, EMERGENCY_LANDING_RADIUS, LANDING_MAX_SPEED } from './game/FlightRules.js'
import { createGameScene } from './game/GameScene.js'
import { BASE_RING_POINTS } from './game/RingSystem.js'
import './App.css'

const TERRAIN_NAMES = { mountain: '산', forest: '숲', canyon: '협곡', sea: '바다' }
const MAP_TERRAIN_NAMES = { ...TERRAIN_NAMES, plain: '평원' }
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

function FlightRoute({ path, distance, discovered = [], landingPad, recommendedRing, showLegend = false, preview = false }) {
  const halfMap = MAP_SIZE / 2
  const xs = path.map(({ x }) => x)
  const zs = path.map(({ z }) => z)
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
  const terrain = getTerrainMap()
  const route = path.map(({ x, z, breakBefore }, index) => `${index === 0 || breakBefore ? 'M' : 'L'}${x},${z}`).join(' ')

  return (
    <div className="flight-route">
      {!preview && <div className="flight-route-heading">
        <span>비행 경로</span>
        <strong>{Math.round(distance).toLocaleString()} <small>u</small></strong>
      </div>}
      <svg
        className="flight-route-map"
        viewBox={`${left - padding} ${top - padding} ${width + padding * 2} ${height + padding * 2}`}
        role="img"
        aria-label={preview ? '탐사할 섬의 지도' : '지형 지도 위에 표시한 비행 경로'}
      >
        {terrain.map(({ key, type, zoneId, elevation, shape }) => (
          <path
            key={key}
            className={`map-terrain-${type}`}
            data-elevation={elevation}
            style={{ '--survey-reveal': preview ? 1 : Number(discovered.includes(zoneId)) }}
            d={shape}
          />
        ))}
        <path className="flight-route-line" d={route} />
        {recommendedRing && (
          <circle className="recommended-map-marker" cx={recommendedRing.x} cy={recommendedRing.z} r={radius * 1.6} />
        )}
        {landingPad && (
          <g className="landing-map-marker">
            <circle cx={landingPad.x} cy={landingPad.z} r={radius * 3.5} />
            <text x={landingPad.x} y={landingPad.z} fontSize={radius * 5}>H</text>
          </g>
        )}
        {start && <circle className="flight-route-start" cx={start.x} cy={start.z} r={radius} />}
        {end && <circle className="flight-route-end" cx={end.x} cy={end.z} r={radius * 1.25} />}
      </svg>
      {showLegend && (
        <ul className="flight-route-legend">
          <li><span className="route-legend-start" />출발</li>
          <li><span className="route-legend-end" />도착</li>
          {landingPad && <li><span className="route-legend-landing" />착륙장</li>}
          {Object.entries(MAP_TERRAIN_NAMES).map(([type, name]) => (
            <li key={type}><span className={`map-terrain-${type}`} />{name}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

// 공통 로고
function Logo() {
  return (
    <div className="brand">
      <span className="brand-icon" aria-hidden="true">✈</span>
      <span>PaperFlight</span>
    </div>
  )
}

// 시작 화면
function StartScreen({ onStart }) {
  return (
    <main className="start-screen">
      <header className="top-header">
        <Logo />
        <span className="version-label">섬 탐사 비행</span>
      </header>

      <div className="start-layout">
      <section className="start-content">
        <h1>섬을<br /> 기록하다.</h1>
        <p className="start-description">
          섬을 자유롭게 탐색하고 비행 경로를 남기세요.
          <br />
          폭풍 경보가 뜨면 H에 착륙해 방재 장치를 복구하세요.
        </p>

        <button className="primary-button start-button" onClick={onStart}>
          비행 시작하기
          <span>→</span>
        </button>

        <FlightControls />
      </section>
      <figure className="start-chart">
        <figcaption>탐사 구역</figcaption>
        <FlightRoute path={[]} distance={0} preview />
      </figure>
      </div>
    </main>
  )
}

function FlightControls() {
  return (
    <div className="control-guide" aria-label="비행 조작">
      {FLIGHT_CONTROLS.map(({ keys, label }) => (
        <div className="control-item" key={label}>
          <span className="control-keys">
            {keys.map((key) => <kbd className="key" key={key}>{key}</kbd>)}
          </span>
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

// 게임 플레이 화면
function PlayingScreen({ progress, sceneContainer, ringDirection, onPause, onFinish, onToggleLandingGuide, isPaused }) {
  const {
    score, passedRings, totalRings, discovered = [], totalRegions = 0, storm, autoLanding,
    terrains, award, speed, distance, path, recoveries, landingPad,
    elapsed, guidance, recoveryReason, outsideSurveyArea,
  } = progress
  const surveyProgress = totalRegions ? discovered.length / totalRegions * 100 : 0
  const guidingLanding = guidance?.kind === 'landing'

  return (
    <main className={storm ? 'game-screen storm-active' : 'game-screen'}>
      <div className="flight-scene" ref={sceneContainer} />
      {/* 상단 UI */}
      <header className="game-header">
        <Logo />

        <div className={`flight-status ${isPaused ? 'paused' : ''}`}>
          <span className="status-dot" />
          {isPaused ? '일시정지' : autoLanding ? '자동 착륙' : storm ? '비상 귀환' : '탐색 중'}
        </div>

        <button className="pause-button" onClick={onPause}>
          <span className="pause-icon">Ⅱ</span>
          <span>일시정지</span>
        </button>
      </header>

      {/* 좌측 탐험 정보 */}
      <aside className="hud-panel exploration-panel">
        <div className="panel-label">발견 구역</div>

        <div className="exploration-number">
          {discovered.length}<span> / {totalRegions}</span>
        </div>

        <div
          className="progress-track" role="progressbar" aria-label="발견 구역"
          aria-valuenow={discovered.length} aria-valuemax={totalRegions || 1}
        >
          <div
            className="progress-fill"
            style={{ width: `${surveyProgress}%` }}
          />
        </div>

        <div className="flight-objective">
          {guidingLanding ? (
            <>
              <strong>{autoLanding ? '자동 착륙 중' : storm ? '폭풍 경보 · 비상 귀환' : '귀환 안내'}</strong>
              {storm ? (
                <span>
                  {autoLanding
                    ? '착륙이 끝나면 복구 미니게임이 열려요.'
                    : `H에서 ${EMERGENCY_LANDING_RADIUS} u 이내, 상대 고도 ${EMERGENCY_LANDING_HEIGHT} u 이하로 접근하면 자동 착륙해요.`}
                </span>
              ) : <span>H에서 {LANDING_MAX_SPEED} u/s 이하로 완만하게 하강하세요.</span>}
            </>
          ) : (
            <>
              <strong>자유 탐색</strong>
              <span>새 구역 위를 지나면 지도에 색이 나타나요.</span>
            </>
          )}
          {landingPad && !storm && passedRings < totalRings && (
            <button className="landing-guide-button" onClick={onToggleLandingGuide}>
              {guidingLanding ? '추천 링 안내' : 'H 착륙장 안내'}
            </button>
          )}
        </div>
        <ul className="flight-terrain-list" aria-label="지형별 링 통과">
          {terrains.map(({ type, passed, total }) => (
            <li key={type} className={passed === total ? 'terrain-complete' : undefined}>
              <span>{TERRAIN_NAMES[type]}</span><strong>{passed}/{total}</strong>
            </li>
          ))}
        </ul>
      </aside>

      {/* 우측 점수 정보 */}
      <aside className="hud-panel score-panel">
        <div className="score-readout">
          <div>
            <div className="panel-label">비행 점수</div>
            <div className="score-number">{score.toLocaleString()} <small>PTS</small></div>
          </div>
          <div className="speed-readout">
            <div className="panel-label">속도</div>
            <div className="speed-number">{Math.floor(speed)} <small>u/s</small></div>
            <meter className="speed-meter" min="0" max={MAX_FLIGHT_SPEED} value={speed} aria-label="현재 비행 속도" />
          </div>
        </div>

        <div className="panel-divider" />

        <div className="stat-row">
          <span>통과한 링</span>
          <strong>{passedRings} <small>/ {totalRings}</small></strong>
        </div>

        <div className="stat-row">
          <span>비행 시간</span>
          <strong>{formatTime(elapsed)}</strong>
        </div>
        <div className="panel-divider" />
        <FlightRoute
          path={path} distance={distance} discovered={discovered} landingPad={landingPad}
          recommendedRing={guidance?.kind === 'ring' ? guidance.position : null}
        />
      </aside>

      <div className={`ring-direction${guidingLanding ? ' landing-direction' : ''}`} ref={ringDirection} hidden>
        <span className="ring-direction-arrow" aria-hidden="true">↑</span>
        <span className="guide-in-view" aria-hidden="true">◎</span>
        <div className="guide-details">
          <strong>{guidingLanding ? 'H 착륙장' : `${TERRAIN_NAMES[guidance?.terrain] ?? ''} 추천 링`}</strong>
          {guidance && <span>{Math.round(guidance.distance).toLocaleString()} u</span>}
          {guidingLanding && storm && !autoLanding && (
            <span>착륙장 기준 고도 {guidance.altitude} u</span>
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
        {award && (
          <div className="ring-feedback-card" key={passedRings}>
            <strong>+{award.points}점</strong>
            {terrains.filter(({ type }) => award.terrains.includes(type)).map(({ type, passed, total }) => (
              <span key={type}>{TERRAIN_NAMES[type]} 조사 {passed}/{total}</span>
            ))}
          </div>
        )}
      </div>

      {/* 하단 조작 안내 */}
      <footer className="game-footer">
        <FlightControls />

        {!storm && <button className="finish-button" onClick={onFinish}>비행 종료 →</button>}
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
      <h2 id="pause-title">비행 일시정지</h2>
      <p className="score-rules">
        링 통과 {BASE_RING_POINTS}점 · H 착륙 성공 +{LANDING_BONUS_POINTS}점
      </p>

      <button className="primary-button modal-primary" onClick={onResume}>
        이어서 비행하기 <span>→</span>
      </button>

      {!storm && <button className="secondary-button" onClick={onRestart}>
        처음부터 다시 시작
      </button>}

      {!storm && <button className="text-button" onClick={onHome}>
        메인 화면으로 돌아가기
      </button>}
    </dialog>
  )
}

// 결과 화면
function ResultScreen({ progress, onRestart, onHome }) {
  const {
    score, ringPoints, landingPoints, passedRings, discovered = [], totalRegions, terrains, distance,
    path, recoveries, landingPad, outcome, elapsed,
  } = progress
  const landed = outcome === 'landed'

  return (
    <main className="result-screen">
      <div className="result-content">
        <div className="result-eyebrow">
          <span />
          {landed ? '종료 사유 · 안전 착륙' : '종료 사유 · 직접 종료'}
          <span />
        </div>

        <h1>비행 기록</h1>
        <p className="result-note">
          {landed ? '착륙장에서 이번 탐색을 마쳤어요.' : '이번 자유 비행을 마쳤어요.'}
          {progress.stormsResolved > 0 && ` 폭풍 대응 ${progress.stormsResolved}회 성공.`}
        </p>

        <div className="result-grid">
          <section className="result-score-card">
            <span className="result-card-label">총점</span>

            <div className="result-score">
              {score.toLocaleString()}
              <span>PTS</span>
            </div>

            <dl className="result-score-breakdown">
              <div><dt>링 통과 점수</dt><dd>{ringPoints.toLocaleString()}점</dd></div>
              <div><dt>착륙 보너스</dt><dd>{landingPoints.toLocaleString()}점</dd></div>
            </dl>

            <div className="result-divider" />

            <div className="result-stats">
              <div>
                <span>링 통과</span>
                <strong>{passedRings}<small>개</small></strong>
              </div>

              <div>
                <span>발견 구역</span>
                <strong>{discovered.length}<small> / {totalRegions}</small></strong>
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
            {terrains.length > 0 && (
              <>
                <div className="result-divider" />
                <h2 className="result-card-label">지형별 조사</h2>
                <ul className="terrain-results">
                  {terrains.map(({ type, passed, total }) => (
                    <li key={type}>
                      <span>{TERRAIN_NAMES[type]}</span>
                      <strong className={passed === total ? 'terrain-complete' : undefined}>
                        {passed === total ? '완료' : `${passed} / ${total}`}
                      </strong>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <section className="result-map-card">
            <FlightRoute path={path} distance={distance} discovered={discovered} landingPad={landingPad} showLegend />
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
  const [gameState, setGameState] = useState('start')
  const [progress, setProgress] = useState(EMPTY_FLIGHT_PROGRESS)
  const sceneContainer = useRef(null)
  const ringDirection = useRef(null)
  const scene = useRef(null)
  const isPaused = gameState === 'paused'
  const docked = gameState === 'repair' || gameState === 'docked'
  const inFlight = gameState === 'playing' || isPaused || docked

  useEffect(() => {
    if (!inFlight) return

    const gameScene = createGameScene(
      THREE, sceneContainer.current, setProgress, ringDirection.current,
      (storm) => setGameState(storm ? 'repair' : 'docked'),
    )
    scene.current = gameScene
    return () => {
      scene.current = null
      gameScene.dispose()
    }
  }, [inFlight])

  useEffect(() => {
    scene.current?.setPaused(isPaused)
  }, [isPaused])

  useEffect(() => {
    if (gameState !== 'playing') return

    const pauseWhenHidden = () => {
      if (document.hidden) setGameState('paused')
    }
    document.addEventListener('visibilitychange', pauseWhenHidden)
    return () => document.removeEventListener('visibilitychange', pauseWhenHidden)
  }, [gameState])

  // 게임 시작
  const startGame = () => {
    setProgress(EMPTY_FLIGHT_PROGRESS)
    setGameState('playing')
  }

  // 게임 재시작
  const restartGame = () => {
    startGame()
    scene.current?.reset()
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
          isPaused={isPaused}
          onPause={() => setGameState('paused')}
          onToggleLandingGuide={() => scene.current?.setLandingGuide(progress.guidance?.kind !== 'landing')}
          onFinish={() => {
            if (scene.current?.finish()) setGameState('result')
          }}
        />
      )}

      {isPaused && (
        <PauseScreen
          onResume={() => setGameState('playing')}
          onRestart={restartGame}
          onHome={goHome}
          storm={progress.storm}
        />
      )}

      {docked && (
        <StormRepair
          repairRequired={gameState === 'repair'}
          onRepair={() => {
            scene.current?.resolveStorm()
            setGameState('docked')
          }}
          onTakeOff={() => {
            scene.current?.takeOff()
            setGameState('playing')
          }}
          onFinish={() => setGameState('result')}
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

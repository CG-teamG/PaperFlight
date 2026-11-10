
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
import { EMPTY_FLIGHT_PROGRESS } from './game/FlightProgress.js'
import { createGameScene } from './game/GameScene.js'
import './App.css'

// 초 단위 시간을 00:00 형식으로 변환
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

// 공통 로고
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
      <header className="top-header">
        <Logo />
        <span className="version-label">3D EXPLORATION GAME</span>
      </header>

      <section className="start-content">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          EXPLORE THE UNKNOWN
        </div>

        <h1>
          PAPER
          <br />
          <span>FLIGHT</span>
        </h1>

        <p className="start-description">
          종이비행기를 타고 미지의 세계를 탐험하세요.
          <br />
          하늘을 가로지르며 새로운 지역을 발견해 보세요.
        </p>

        <button className="primary-button start-button" onClick={onStart}>
          비행 시작하기
          <span>→</span>
        </button>

        <div className="start-hint">
          <span className="hint-dot" />
          준비되었다면 하늘로 날아오르세요
        </div>
      </section>

      <footer className="start-bottom">
        <span>EXPLORE · DISCOVER · FLY</span>
        <span>© PAPERFLIGHT 2026</span>
      </footer>
    </main>
  )
}

// 게임 플레이 화면
function PlayingScreen({ time, progress, sceneContainer, onPause, onFinish, isPaused }) {
  const { score, passedRings, totalRings, exploration, completedTerrains, totalTerrains } = progress

  return (
    <main className="game-screen">
      <div className="flight-scene" ref={sceneContainer} />
      {/* 상단 UI */}
      <header className="game-header">
        <Logo />

        <div className={`flight-status ${isPaused ? 'paused' : ''}`}>
          <span className="status-dot" />
          {isPaused ? 'PAUSED' : 'IN FLIGHT'}
        </div>

        <button className="pause-button" onClick={onPause}>
          <span className="pause-icon">Ⅱ</span>
          <span>일시정지</span>
        </button>
      </header>

      {/* 좌측 탐험 정보 */}
      <aside className="hud-panel exploration-panel">
        <div className="panel-label">EXPLORATION</div>

        <div className="exploration-number">
          {exploration}<span>%</span>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${exploration}%` }}
          />
        </div>

        <div className="panel-bottom">
          <span>탐험 완료 지형</span>
          <strong>{completedTerrains} / {totalTerrains}</strong>
        </div>

        <div className="panel-divider" />

        <div className="region-status">
          <span className="region-indicator" />
          새로운 지역 탐험 중
        </div>
      </aside>

      {/* 우측 점수 정보 */}
      <aside className="hud-panel score-panel">
        <div className="panel-label">FLIGHT SCORE</div>

        <div className="score-number">
          {score.toLocaleString()}
          <span>PTS</span>
        </div>

        <div className="panel-divider" />

        <div className="stat-row">
          <span>통과한 링</span>
          <strong>{passedRings} <small>/ {totalRings}</small></strong>
        </div>

        <div className="stat-row">
          <span>비행 시간</span>
          <strong>{formatTime(time)}</strong>
        </div>
      </aside>

      {/* 중앙 안내 */}
      <div className="center-message">
        <span />
        KEEP EXPLORING
        <span />
      </div>

      {/* 하단 조작 안내 */}
      <footer className="game-footer">
        <div className="control-guide">
          <div className="control-item">
            <span className="key">↑</span>
            <span>상승</span>
          </div>
          <div className="control-item">
            <span className="key">↓</span>
            <span>하강</span>
          </div>
          <div className="control-item">
            <span className="key">←</span>
            <span>좌회전</span>
          </div>
          <div className="control-item">
            <span className="key">→</span>
            <span>우회전</span>
          </div>
          <div className="control-item">
            <span className="key">A</span>
            <span className="key">D</span>
            <span>날개 기울이기</span>
          </div>
        </div>

        <button className="finish-button" onClick={onFinish}>
          비행 종료하기 →
        </button>
      </footer>
    </main>
  )
}

// 일시정지 팝업
function PauseScreen({ onResume, onRestart, onHome }) {
  return (
    <div className="modal-overlay">
      <div className="pause-modal">
        <div className="modal-eyebrow">FLIGHT PAUSED</div>
        <div className="modal-symbol">Ⅱ</div>

        <h2>잠시 쉬어가세요.</h2>
        <p>비행이 일시정지되었습니다.</p>

        <button className="primary-button modal-primary" onClick={onResume}>
          이어서 비행하기 <span>→</span>
        </button>

        <button className="secondary-button" onClick={onRestart}>
          처음부터 다시 시작
        </button>

        <button className="text-button" onClick={onHome}>
          메인 화면으로 돌아가기
        </button>
      </div>
    </div>
  )
}

// 결과 화면
function ResultScreen({ time, progress, onRestart, onHome }) {
  const { score, passedRings, exploration } = progress

  return (
    <main className="result-screen">
      <div className="result-content">
        <div className="result-eyebrow">
          <span />
          FLIGHT COMPLETED
          <span />
        </div>

        <h1>비행을 완료했어요!</h1>
        <p className="result-description">
          새로운 세계를 향한 멋진 비행이었습니다.
        </p>

        <section className="result-score-card">
          <span className="result-card-label">TOTAL SCORE</span>

          <div className="result-score">
            {score.toLocaleString()}
            <span>PTS</span>
          </div>

          <div className="result-divider" />

          <div className="result-stats">
            <div>
              <span>링 통과</span>
              <strong>{passedRings}<small>개</small></strong>
            </div>

            <div>
              <span>탐험률</span>
              <strong>{exploration}<small>%</small></strong>
            </div>

            <div>
              <span>비행 시간</span>
              <strong>{formatTime(time)}</strong>
            </div>
          </div>
        </section>

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
  const [time, setTime] = useState(0)
  const [progress, setProgress] = useState(EMPTY_FLIGHT_PROGRESS)
  const sceneContainer = useRef(null)
  const scene = useRef(null)
  const isPaused = gameState === 'paused'
  const inFlight = gameState === 'playing' || isPaused

  useEffect(() => {
    if (!inFlight) return

    const gameScene = createGameScene(THREE, sceneContainer.current, setProgress)
    scene.current = gameScene
    return () => {
      scene.current = null
      gameScene.dispose()
    }
  }, [inFlight])

  useEffect(() => {
    scene.current?.setPaused(isPaused)
  }, [isPaused])

  // 게임이 진행 중일 때만 시간 증가
  useEffect(() => {
    if (gameState !== 'playing') return

    const timer = setInterval(() => {
      setTime((previousTime) => previousTime + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [gameState])

  // 게임 시작
  const startGame = () => {
    setTime(0)
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
    setTime(0)
    setGameState('start')
  }

  return (
    <div className="app">
      {gameState === 'start' && (
        <StartScreen onStart={startGame} />
      )}

      {inFlight && (
        <PlayingScreen
          time={time}
          progress={progress}
          sceneContainer={sceneContainer}
          isPaused={isPaused}
          onPause={() => setGameState('paused')}
          onFinish={() => setGameState('result')}
        />
      )}

      {isPaused && (
        <PauseScreen
          onResume={() => setGameState('playing')}
          onRestart={restartGame}
          onHome={goHome}
        />
      )}

      {gameState === 'result' && (
        <ResultScreen
          time={time}
          progress={progress}
          onRestart={restartGame}
          onHome={goHome}
        />
      )}
    </div>
  )
}

export default App

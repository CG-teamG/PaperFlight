// App.jsx과 동일한 형태, 기능 테스트용 임시 ui

import { useEffect, useRef, useState } from "react";
import * as THREE from "three"; // [3D]
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"; // [3D]
import { ExplorationMap } from "../game/ExplorationMap.js"; // [3D]
import { createGameRuntime } from "./gameRuntime.js"; // [3D]
import "../App.css";
import "./preview.css"; // [3D]

// 초 단위 시간을 00:00 형식으로 변환
function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

// 공통 로고
function Logo() {
  return (
    <div className="brand">
      <div className="brand-icon">✈</div>
      <span>
        PAPER<span>FLIGHT</span>
      </span>
    </div>
  );
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
  );
}

// 게임 플레이 화면
function PlayingScreen({ time, stats, onPause, onFinish, isPaused = false }) {
  // [3D] 임시 데이터 대신 게임에서 받은 값
  const { score, passedRings, exploration, discovered, totalRegions } = stats;

  return (
    <main className="game-screen">
      {/* 상단 UI */}
      <header className="game-header">
        <Logo />

        <div className={`flight-status ${isPaused ? "paused" : ""}`}>
          <span className="status-dot" />
          {isPaused ? "PAUSED" : "IN FLIGHT"}
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
          {exploration}
          <span>%</span>
        </div>

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${exploration}%` }} />
        </div>

        <div className="panel-bottom">
          <span>발견한 지역</span>
          <strong>
            {discovered} / {totalRegions}
          </strong>
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
          <strong>
            {passedRings} <small>/ {stats.totalRings}</small>
          </strong>
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
        </div>

        <button className="finish-button" onClick={onFinish}>
          비행 종료하기 →
        </button>
      </footer>
    </main>
  );
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
  );
}

// 결과 화면
// [3D] 결과 화면의 "내 탐험 지도": 이번 판의 맵 + 비행 경로 (드래그로 회전)
function ExplorationMapCard({ result }) {
  const viewRef = useRef(null);

  useEffect(() => {
    const map = new ExplorationMap(
      THREE,
      OrbitControls,
      viewRef.current,
      result.mapData,
      result.trail,
    );
    return () => map.dispose();
  }, [result]);

  return (
    <section className="result-map-card">
      <div className="result-card-label">MY EXPLORATION MAP</div>
      <div ref={viewRef} className="result-map-view" />
      <div className="result-map-hint">
        드래그: 회전 · 휠: 확대/축소 · 경로 색: 낮음(하늘색) → 높음(남색)
      </div>
    </section>
  );
}

function ResultScreen({ time, result, onRestart, onHome }) {
  const { score, passedRings, exploration } = result.stats; // [3D]

  return (
    <main className="result-screen has-map">
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
              <strong>
                {passedRings}
                <small>개</small>
              </strong>
            </div>

            <div>
              <span>탐험률</span>
              <strong>
                {exploration}
                <small>%</small>
              </strong>
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
      <ExplorationMapCard result={result} /> {/* [3D] */}
    </main>
  );
}

// 전체 앱
const EMPTY_STATS = {
  score: 0,
  passedRings: 0,
  totalRings: 16,
  exploration: 0,
  discovered: 0,
  totalRegions: 16,
};

function App() {
  const [gameState, setGameState] = useState("start");
  const [time, setTime] = useState(0);

  // [3D] 3D 장면 연결
  const [stats, setStats] = useState(EMPTY_STATS);
  const [result, setResult] = useState(null);
  const [runId, setRunId] = useState(0);
  const canvasRef = useRef(null);
  const runtimeRef = useRef(null);

  useEffect(() => {
    const runtime = createGameRuntime(canvasRef.current, setStats);
    runtimeRef.current = runtime;
    return () => runtime.dispose();
  }, []);

  // [3D] 시작 / 다시 시작 / 다시 비행: 새 지형·링으로 한 판 시작
  useEffect(() => {
    if (runId > 0) runtimeRef.current.start();
  }, [runId]);

  // [3D] 일시정지 중에는 비행·연출을 멈춘다
  useEffect(() => {
    runtimeRef.current?.setPaused(gameState !== "playing");
  }, [gameState]);

  // 게임이 진행 중일 때만 시간 증가
  useEffect(() => {
    if (gameState !== "playing") return;

    const timer = setInterval(() => {
      setTime((previousTime) => previousTime + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState]);

  // 게임 시작
  const startGame = () => {
    setTime(0);
    setRunId((n) => n + 1); // [3D]
    setGameState("playing");
  };

  // 게임 재시작
  const restartGame = () => {
    setTime(0);
    setRunId((n) => n + 1); // [3D]
    setGameState("playing");
  };

  // [3D] 비행 종료: 결과 화면에 쓸 값과 탐험 지도 데이터를 받아 둔다
  const finishGame = () => {
    setResult(runtimeRef.current.getResult());
    setGameState("result");
  };

  // 메인 화면으로 이동
  const goHome = () => {
    setTime(0);
    setGameState("start");
  };

  return (
    <div className="app">
      {/* [3D] 3D 화면: 플레이/일시정지 중에만 보인다 */}
      <div
        ref={canvasRef}
        className="three-canvas"
        style={{
          display:
            gameState === "playing" || gameState === "paused"
              ? "block"
              : "none",
        }}
      />

      {gameState === "start" && <StartScreen onStart={startGame} />}

      {gameState === "playing" && (
        <PlayingScreen
          time={time}
          stats={stats}
          onPause={() => setGameState("paused")}
          onFinish={finishGame}
        />
      )}

      {gameState === "paused" && (
        <>
          <PlayingScreen
            time={time}
            stats={stats}
            onPause={() => {}}
            onFinish={finishGame}
            isPaused={true}
          />

          <PauseScreen
            onResume={() => setGameState("playing")}
            onRestart={restartGame}
            onHome={goHome}
          />
        </>
      )}

      {gameState === "result" && (
        <ResultScreen
          time={time}
          result={result}
          onRestart={restartGame}
          onHome={goHome}
        />
      )}
    </div>
  );
}

export default App;

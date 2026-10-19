// ============================================================
// 파일명: GameHUD.jsx
// 담당자: 팀원 C - 예빈
// 역할: 게임 진행 중 필요한 정보를 화면에 표시한다.
// 구현할 기능:
// 1. 통과한 링의 개수를 표시한다.
// 2. 전체 탐험 진행률을 표시한다.
// 3. 필요에 따라 비행 상태와 점수를 표시한다.
// ============================================================

export default function GameHUD({
    ringsPassed = 0,
    explorationProgress = 0
}) {
    return (
        <section className="game-hud">
            <p>통과한 링: {ringsPassed}</p>
            <p>탐험 진행률: {explorationProgress}%</p>
        </section>
    );
}

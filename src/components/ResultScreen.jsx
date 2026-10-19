// ============================================================
// 파일명: ResultScreen.jsx
// 담당자: 팀원 C - 예빈
// 역할: 비행 종료 후 게임 결과를 표시한다.
// 구현할 기능:
// 1. 최종 통과 링 개수를 표시한다.
// 2. 최종 탐험 진행률을 표시한다.
// 3. 다시 시작할 수 있는 버튼을 제공한다.
// ============================================================

export default function ResultScreen({
    ringsPassed = 0,
    explorationProgress = 0,
    onRestart
}) {
    return (
        <section className="result-screen">
            <h2>비행 완료!</h2>
            <p>통과한 링: {ringsPassed}</p>
            <p>탐험 진행률: {explorationProgress}%</p>
            <button onClick={onRestart}>다시 플레이</button>
        </section>
    );
}

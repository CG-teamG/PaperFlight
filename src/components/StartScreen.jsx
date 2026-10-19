// ============================================================
// 파일명: StartScreen.jsx
// 담당자: 팀원 C - 예빈
// 역할: 게임 제목과 시작 버튼을 표시한다.
// 구현할 기능:
// 1. 게임 제목과 소개 문구를 표시한다.
// 2. 게임 조작 방법을 안내한다.
// 3. 시작 버튼을 눌렀을 때 게임을 시작한다.
// ============================================================

export default function StartScreen({ onStart }) {
    return (
        <section className="start-screen">
            <h1>Paper Flight</h1>
            <p>미지의 3D 세계를 탐험하는 종이비행기 비행 시뮬레이션</p>
            <button onClick={onStart}>비행 시작</button>
        </section>
    );
}

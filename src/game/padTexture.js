// ============================================================
// 파일명: padTexture.js
// 담당자: 선유 - 3D 그래픽
// 역할: 착륙 지점 "H" 표식 이미지를 만든다. (게임 장면의 착륙 패드와 결과 화면 탐험 지도가 함께 사용)
// ============================================================

// 패드 윗면: 밝은 주황 원판 + 흰 테두리 + 굵은 흰색 H
export function createPadTexture(THREE) {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const mid = S / 2;

  g.fillStyle = "#ffa000";
  g.beginPath();
  g.arc(mid, mid, mid, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 22;
  g.beginPath();
  g.arc(mid, mid, mid * 0.86, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 8;
  g.strokeStyle = "rgba(255,255,255,0.6)";
  g.beginPath();
  g.arc(mid, mid, mid * 0.72, 0, Math.PI * 2);
  g.stroke();

  // H: 양쪽 기둥 + 가운데 가로대
  g.fillStyle = "#ffffff";
  const bar = 62;
  const half = mid * 0.4;
  g.fillRect(mid - half - bar / 2, mid - half * 1.15, bar, half * 2.3);
  g.fillRect(mid + half - bar / 2, mid - half * 1.15, bar, half * 2.3);
  g.fillRect(mid - half, mid - bar / 2, half * 2, bar);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// 멀리서 보이는 마커: 노란 둥근 배지 안의 흰색 H (화면 크기 고정 스프라이트용)
export function createHMarkerTexture(THREE) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const mid = S / 2;

  g.fillStyle = "rgba(20,30,60,0.55)";
  g.beginPath();
  g.arc(mid, mid, mid - 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#ffb300";
  g.beginPath();
  g.arc(mid, mid, mid - 12, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 6;
  g.stroke();

  g.fillStyle = "#ffffff";
  const bar = 15;
  const h = 30;
  g.fillRect(mid - h - bar / 2, mid - h * 1.05, bar, h * 2.1);
  g.fillRect(mid + h - bar / 2, mid - h * 1.05, bar, h * 2.1);
  g.fillRect(mid - h, mid - bar / 2, h * 2, bar);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

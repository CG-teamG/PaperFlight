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

export function createHMarkerTexture(THREE) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d");
  const mid = S / 2;

  // Outline the amber strokes so the H stays legible over the beacon.
  const amber = "#ffd287";
  const ink = "#45301e";
  g.beginPath();
  g.arc(mid, mid, mid - 10, 0, Math.PI * 2);
  g.lineWidth = 11;
  g.strokeStyle = ink;
  g.stroke();
  g.lineWidth = 7;
  g.strokeStyle = amber;
  g.stroke();

  g.beginPath();
  g.moveTo(47, 39);
  g.lineTo(47, 89);
  g.moveTo(81, 39);
  g.lineTo(81, 89);
  g.moveTo(47, mid);
  g.lineTo(81, mid);
  g.lineWidth = 14;
  g.strokeStyle = ink;
  g.stroke();
  g.lineWidth = 10;
  g.strokeStyle = amber;
  g.stroke();

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

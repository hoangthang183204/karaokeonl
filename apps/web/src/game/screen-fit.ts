/** Maps a straight rectangle onto the TV screen's four corners. */

function adjugate(m: number[]): number[] {
  return [
    m[4] * m[8] - m[5] * m[7],
    m[2] * m[7] - m[1] * m[8],
    m[1] * m[5] - m[2] * m[4],
    m[5] * m[6] - m[3] * m[8],
    m[0] * m[8] - m[2] * m[6],
    m[2] * m[3] - m[0] * m[5],
    m[3] * m[7] - m[4] * m[6],
    m[1] * m[6] - m[0] * m[7],
    m[0] * m[4] - m[1] * m[3],
  ];
}

function multiply(a: number[], b: number[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] = a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col];
    }
  }
  return out;
}

function multiplyVector(m: number[], v: number[]): number[] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function basis(points: { x: number; y: number }[]): number[] {
  const [a, b, c, d] = points;
  const m = [a.x, b.x, c.x, a.y, b.y, c.y, 1, 1, 1];
  const v = multiplyVector(adjugate(m), [d.x, d.y, 1]);
  return multiply(m, [v[0], 0, 0, 0, v[1], 0, 0, 0, v[2]]);
}

function homography(source: { x: number; y: number }[], dest: { x: number; y: number }[]): number[] {
  const mapped = multiply(basis(dest), adjugate(basis(source)));
  const scale = mapped[8] || 1;
  return mapped.map((value) => value / scale);
}

export function screenMatrix(width: number, height: number, corners: { x: number; y: number }[]): string {
  const source = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ];
  const h = homography(source, corners);
  const m = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, h[8]];
  return `matrix3d(${m.map((value) => Number(value.toPrecision(12))).join(",")})`;
}

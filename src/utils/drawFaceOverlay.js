const FACE_CONTOUR = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400,
  377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67,
  109
];

const JAWLINE = [
  234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397,
  288, 361, 323, 454
];

const LEFT_EYEBROW = [70, 63, 105, 66, 107, 55, 65, 52, 53, 46];
const RIGHT_EYEBROW = [336, 296, 334, 293, 300, 285, 295, 282, 283, 276];

const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE = [
  362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398
];

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];

const NOSE_BRIDGE = [168, 6, 197, 195, 5, 4];
const NOSE_WINGS = [129, 98, 97, 2, 326, 327, 358];

const OUTER_LIPS = [
  61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87,
  178, 88, 95, 78
];
const INNER_LIPS = [
  78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80,
  191
];

const LEFT_CHEEK = [50, 101, 205, 187, 147, 123, 116];
const RIGHT_CHEEK = [280, 330, 425, 411, 376, 352, 345];

const ANALYSIS_POINTS = [10, 152, 234, 454, 127, 356, 93, 323, 172, 397];

const COLORS = {
  contour: [220, 88, 58],
  jaw: [172, 70, 42],
  brow: [39, 95, 49],
  eye: [262, 84, 64],
  iris: [2, 85, 59],
  nose: [153, 74, 39],
  lip: [336, 80, 58],
  cheek: [196, 86, 52],
  metric: [28, 96, 56]
};

const REGION_CONFIGS = [
  { indices: FACE_CONTOUR, color: COLORS.contour, width: 1.8, closed: true },
  { indices: JAWLINE, color: COLORS.jaw, width: 2, closed: false },
  { indices: LEFT_EYEBROW, color: COLORS.brow, width: 1.6, closed: false },
  { indices: RIGHT_EYEBROW, color: COLORS.brow, width: 1.6, closed: false },
  { indices: LEFT_EYE, color: COLORS.eye, width: 1.6, closed: true, fillAlpha: 0.08 },
  { indices: RIGHT_EYE, color: COLORS.eye, width: 1.6, closed: true, fillAlpha: 0.08 },
  { indices: LEFT_IRIS, color: COLORS.iris, width: 1.6, closed: true, fillAlpha: 0.12 },
  { indices: RIGHT_IRIS, color: COLORS.iris, width: 1.6, closed: true, fillAlpha: 0.12 },
  { indices: NOSE_BRIDGE, color: COLORS.nose, width: 1.5, closed: false },
  { indices: NOSE_WINGS, color: COLORS.nose, width: 1.5, closed: false },
  { indices: OUTER_LIPS, color: COLORS.lip, width: 1.6, closed: true, fillAlpha: 0.1 },
  { indices: INNER_LIPS, color: COLORS.lip, width: 1.3, closed: true, fillAlpha: 0.07 },
  { indices: LEFT_CHEEK, color: COLORS.cheek, width: 1.2, closed: false },
  { indices: RIGHT_CHEEK, color: COLORS.cheek, width: 1.2, closed: false }
];

function hsla(color, alpha) {
  return `hsla(${color[0]}, ${color[1]}%, ${color[2]}%, ${alpha})`;
}

function resolveViewport(canvasEl, viewport) {
  if (
    viewport &&
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Number.isFinite(viewport.width) &&
    Number.isFinite(viewport.height)
  ) {
    return viewport;
  }

  return {
    x: 0,
    y: 0,
    width: canvasEl.width,
    height: canvasEl.height
  };
}

function pointToCanvas(point, viewport) {
  return {
    x: viewport.x + point.x * viewport.width,
    y: viewport.y + point.y * viewport.height
  };
}

function getScaledPoints(landmarks, indices, viewport) {
  return indices
    .map((index) => landmarks[index])
    .filter(Boolean)
    .map((point) => pointToCanvas(point, viewport));
}

function drawRegion(ctx, landmarks, config, viewport, emphasis = 1) {
  const points = getScaledPoints(landmarks, config.indices, viewport);
  if (points.length < 2) {
    return;
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });

  if (config.closed) {
    ctx.closePath();
  }

  ctx.strokeStyle = hsla(config.color, 0.85 * emphasis);
  ctx.lineWidth = config.width;
  ctx.stroke();

  if (config.fillAlpha) {
    ctx.fillStyle = hsla(config.color, config.fillAlpha * emphasis);
    ctx.fill();
  }
}

function drawLandmarkCloud(ctx, landmarks, viewport, emphasis = 1) {
  for (let i = 0; i < landmarks.length; i += 1) {
    const point = landmarks[i];
    if (!point) {
      continue;
    }

    const scaled = pointToCanvas(point, viewport);
    const hue = 200 + Math.round((i / Math.max(1, landmarks.length - 1)) * 170);
    const radius = i >= 468 ? 2.15 : 1.25;

    ctx.fillStyle = `hsla(${hue}, 90%, 60%, ${0.57 * emphasis})`;
    ctx.beginPath();
    ctx.arc(scaled.x, scaled.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawAnalysisAnchors(ctx, landmarks, viewport, emphasis = 1) {
  ANALYSIS_POINTS.forEach((index) => {
    const point = landmarks[index];
    if (!point) {
      return;
    }

    const scaled = pointToCanvas(point, viewport);
    ctx.beginPath();
    ctx.arc(scaled.x, scaled.y, 2.8, 0, Math.PI * 2);
    ctx.fillStyle = hsla(COLORS.metric, 0.95 * emphasis);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(scaled.x, scaled.y, 4.7, 0, Math.PI * 2);
    ctx.strokeStyle = hsla(COLORS.metric, 0.38 * emphasis);
    ctx.lineWidth = 1.2;
    ctx.stroke();
  });
}

function drawFace(ctx, landmarks, viewport, emphasis = 1) {
  REGION_CONFIGS.forEach((config) => {
    drawRegion(ctx, landmarks, config, viewport, emphasis);
  });

  drawLandmarkCloud(ctx, landmarks, viewport, emphasis);
  drawAnalysisAnchors(ctx, landmarks, viewport, emphasis);
}

export function drawFaceOverlay(canvasEl, faces, { showLandmarks, viewport } = {}) {
  const ctx = canvasEl.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);

  if (!faces?.length || !showLandmarks) {
    return;
  }

  const resolvedViewport = resolveViewport(canvasEl, viewport);

  faces.forEach((face, faceIndex) => {
    const emphasis = faceIndex === 0 ? 1 : 0.55;
    drawFace(ctx, face, resolvedViewport, emphasis);
  });
}

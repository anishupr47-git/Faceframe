import { extractFaceMeasurements } from "./faceAnalysis";

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function drawIntoCanvas(sourceImage, width, height) {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(sourceImage, 0, 0, width, height);
  return canvas;
}

function buildCandidate(baseCanvas, padding, label, bias = 0) {
  const srcWidth = baseCanvas.width;
  const srcHeight = baseCanvas.height;

  const padLeft = Math.round(srcWidth * padding.left);
  const padRight = Math.round(srcWidth * padding.right);
  const padTop = Math.round(srcHeight * padding.top);
  const padBottom = Math.round(srcHeight * padding.bottom);

  const width = srcWidth + padLeft + padRight;
  const height = srcHeight + padTop + padBottom;

  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(baseCanvas, padLeft, padTop, srcWidth, srcHeight);

  return {
    label,
    bias,
    canvas,
    sourceWidth: srcWidth,
    sourceHeight: srcHeight,
    padLeft,
    padTop,
    width,
    height
  };
}

function mapPointToOriginal(point, candidate) {
  const xPx = point.x * candidate.width - candidate.padLeft;
  const yPx = point.y * candidate.height - candidate.padTop;

  return {
    x: xPx / candidate.sourceWidth,
    y: yPx / candidate.sourceHeight,
    z: point.z,
    visibility: point.visibility,
    presence: point.presence
  };
}

function mapLandmarksToOriginal(landmarks, candidate) {
  return landmarks.map((point) => mapPointToOriginal(point, candidate));
}

function getBounds(landmarks) {
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of landmarks) {
    if (!point) {
      continue;
    }

    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function scoreCandidate(primaryFace, candidate) {
  const measurement = extractFaceMeasurements(primaryFace);
  const bounds = getBounds(primaryFace);

  if (!measurement || !bounds) {
    return {
      score: -Infinity,
      measurement,
      bounds
    };
  }

  const foreheadY = primaryFace[10]?.y ?? bounds.minY;
  const area = Math.max(0, bounds.width) * Math.max(0, bounds.height);

  let score = 0;
  score += measurement.faceLength * 4.2;
  score += measurement.cheekboneWidth * 2.1;
  score += area * 3.4;
  if (measurement.isFrontal) {
    score += 0.6;
  }

  if (foreheadY < -0.08) {
    score -= 0.55;
  } else if (foreheadY < 0.01) {
    score -= 0.32;
  }

  if (bounds.width < 0.14 || bounds.height < 0.16) {
    score -= 0.35;
  }

  score += candidate.bias;

  return {
    score,
    measurement,
    bounds
  };
}

export function detectBestImageLandmarks(imageLandmarker, imageEl) {
  const width = imageEl.naturalWidth || imageEl.width;
  const height = imageEl.naturalHeight || imageEl.height;

  if (!width || !height) {
    return {
      faces: [],
      candidateLabel: "none"
    };
  }

  const baseCanvas = drawIntoCanvas(imageEl, width, height);
  if (!baseCanvas) {
    return {
      faces: [],
      candidateLabel: "none"
    };
  }

  const candidates = [
    buildCandidate(baseCanvas, { top: 0, right: 0, bottom: 0, left: 0 }, "original", 0.1),
    buildCandidate(baseCanvas, { top: 0.28, right: 0.12, bottom: 0.14, left: 0.12 }, "expanded", 0),
    buildCandidate(baseCanvas, { top: 0.42, right: 0.2, bottom: 0.18, left: 0.2 }, "expanded_top", -0.05)
  ].filter(Boolean);

  let best = null;

  for (const candidate of candidates) {
    const result = imageLandmarker.detect(candidate.canvas);
    const faces = result?.faceLandmarks ?? [];
    if (!faces.length) {
      continue;
    }

    const mappedFaces = faces.map((landmarks) => mapLandmarksToOriginal(landmarks, candidate));
    const scored = scoreCandidate(mappedFaces[0], candidate);

    if (!best || scored.score > best.score) {
      best = {
        score: scored.score,
        faces: mappedFaces,
        candidateLabel: candidate.label,
        quality: {
          isFrontal: Boolean(scored.measurement?.isFrontal),
          bounds: scored.bounds,
          foreheadY: mappedFaces[0]?.[10]?.y
        }
      };
    }
  }

  if (!best) {
    return {
      faces: [],
      candidateLabel: "none"
    };
  }

  return best;
}

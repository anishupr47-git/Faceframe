const LANDMARKS = {
  foreheadTop: 10,
  chinBottom: 152,
  faceLeft: 234,
  faceRight: 454,
  foreheadLeftTemple: 103,
  foreheadRightTemple: 332,
  cheekLeft: 93,
  cheekRight: 323,
  jawLeft: 172,
  jawRight: 397,
  noseTip: 1
};

const WIDTH_NARROW_THRESHOLD = 0.93;
const WIDTH_WIDE_THRESHOLD = 1.07;
const FACE_SHORT_THRESHOLD = 1.18;
const FACE_LONG_THRESHOLD = 1.38;

// TODO: Calibrate these thresholds with real-world capture data from your users.
const FRONTAL_RULES = {
  maxNoseCenterOffsetRatio: 0.12,
  minCheekSymmetryRatio: 0.75,
  minFaceWidthNorm: 0.16,
  minFaceHeightNorm: 0.18
};

function distance2D(pointA, pointB) {
  if (!pointA || !pointB) {
    return 0;
  }

  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function safeDivide(value, byValue) {
  if (!byValue) {
    return 0;
  }

  return value / byValue;
}

function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function widthType(ratio) {
  if (ratio < WIDTH_NARROW_THRESHOLD) {
    return "narrow";
  }

  if (ratio > WIDTH_WIDE_THRESHOLD) {
    return "wide";
  }

  return "balanced";
}

export function cheekType(foreheadWidth, cheekboneWidth, jawWidth) {
  const maxOther = Math.max(foreheadWidth, jawWidth);
  if (!maxOther) {
    return "balanced";
  }

  if (cheekboneWidth > maxOther * 1.05) {
    return "wide";
  }

  if (cheekboneWidth < maxOther * 0.95) {
    return "narrow";
  }

  return "balanced";
}

export function faceLengthType(faceRatio) {
  if (faceRatio < FACE_SHORT_THRESHOLD) {
    return "short";
  }

  if (faceRatio > FACE_LONG_THRESHOLD) {
    return "long";
  }

  return "balanced";
}

export function extractFaceMeasurements(landmarks) {
  if (!Array.isArray(landmarks) || !landmarks.length) {
    return null;
  }

  const foreheadTop = landmarks[LANDMARKS.foreheadTop];
  const chinBottom = landmarks[LANDMARKS.chinBottom];
  const faceLeft = landmarks[LANDMARKS.faceLeft];
  const faceRight = landmarks[LANDMARKS.faceRight];
  const noseTip = landmarks[LANDMARKS.noseTip] || landmarks[4];

  const faceLength = distance2D(foreheadTop, chinBottom);
  const foreheadWidth = distance2D(
    landmarks[LANDMARKS.foreheadLeftTemple],
    landmarks[LANDMARKS.foreheadRightTemple]
  );
  const cheekboneWidth = distance2D(landmarks[LANDMARKS.cheekLeft], landmarks[LANDMARKS.cheekRight]);
  const jawWidth = distance2D(landmarks[LANDMARKS.jawLeft], landmarks[LANDMARKS.jawRight]);

  if (!faceLength || !foreheadWidth || !cheekboneWidth || !jawWidth || !faceLeft || !faceRight || !noseTip) {
    return null;
  }

  const faceWidthNorm = Math.abs(faceRight.x - faceLeft.x);
  const faceHeightNorm = Math.abs(chinBottom.y - foreheadTop.y);
  const faceCenterX = (faceLeft.x + faceRight.x) / 2;
  const noseCenterOffsetRatio = safeDivide(Math.abs(noseTip.x - faceCenterX), faceWidthNorm);

  const leftCheekGap = Math.abs(noseTip.x - faceLeft.x);
  const rightCheekGap = Math.abs(faceRight.x - noseTip.x);
  const cheekSymmetryRatio = safeDivide(
    Math.min(leftCheekGap, rightCheekGap),
    Math.max(leftCheekGap, rightCheekGap)
  );

  const frontalCheck = {
    noseCenterOffsetRatio,
    cheekSymmetryRatio,
    faceWidthNorm,
    faceHeightNorm,
    isLargeEnough:
      faceWidthNorm >= FRONTAL_RULES.minFaceWidthNorm && faceHeightNorm >= FRONTAL_RULES.minFaceHeightNorm
  };

  const isFrontal =
    frontalCheck.isLargeEnough &&
    noseCenterOffsetRatio <= FRONTAL_RULES.maxNoseCenterOffsetRatio &&
    cheekSymmetryRatio >= FRONTAL_RULES.minCheekSymmetryRatio;

  return {
    faceLength,
    foreheadWidth,
    cheekboneWidth,
    jawWidth,
    isFrontal,
    frontalCheck,
    landmarksUsed: LANDMARKS
  };
}

export function averageMeasurements(measurementsList) {
  if (!Array.isArray(measurementsList) || !measurementsList.length) {
    return null;
  }

  const valid = measurementsList.filter(Boolean);
  if (!valid.length) {
    return null;
  }

  return {
    faceLength: mean(valid.map((item) => item.faceLength)),
    foreheadWidth: mean(valid.map((item) => item.foreheadWidth)),
    cheekboneWidth: mean(valid.map((item) => item.cheekboneWidth)),
    jawWidth: mean(valid.map((item) => item.jawWidth)),
    isFrontal: true,
    frontalCheck: {
      noseCenterOffsetRatio: mean(valid.map((item) => item.frontalCheck.noseCenterOffsetRatio)),
      cheekSymmetryRatio: mean(valid.map((item) => item.frontalCheck.cheekSymmetryRatio)),
      faceWidthNorm: mean(valid.map((item) => item.frontalCheck.faceWidthNorm)),
      faceHeightNorm: mean(valid.map((item) => item.frontalCheck.faceHeightNorm)),
      isLargeEnough: true
    }
  };
}

export function classifyFaceTraits(faceLength, foreheadWidth, cheekboneWidth, jawWidth) {
  const faceRatio = safeDivide(faceLength, cheekboneWidth);
  const foreheadRatio = safeDivide(foreheadWidth, cheekboneWidth);
  const jawRatio = safeDivide(jawWidth, cheekboneWidth);

  return {
    foreheadType: widthType(foreheadRatio),
    jawType: widthType(jawRatio),
    cheekboneType: cheekType(foreheadWidth, cheekboneWidth, jawWidth),
    faceLengthType: faceLengthType(faceRatio),
    ratios: {
      faceRatio,
      foreheadRatio,
      jawRatio
    }
  };
}

export function detectFaceShape({ faceLength, foreheadWidth, cheekboneWidth, jawWidth }) {
  const faceRatio = safeDivide(faceLength, cheekboneWidth);
  const foreheadRatio = safeDivide(foreheadWidth, cheekboneWidth);
  const jawRatio = safeDivide(jawWidth, cheekboneWidth);

  const scores = {
    round: 0,
    oval: 0,
    square: 0,
    heart: 0,
    diamond: 0,
    rectangle: 0
  };

  if (faceRatio < 1.2) scores.round += 2;
  if (cheekboneWidth >= foreheadWidth * 1.02) scores.round += 1;
  if (cheekboneWidth >= jawWidth * 1.02) scores.round += 1;
  if (Math.abs(jawRatio - 1) < 0.08) scores.round += 1;

  if (faceRatio >= 1.23 && faceRatio <= 1.42) scores.oval += 2;
  if (foreheadRatio >= 0.92 && foreheadRatio <= 1.05) scores.oval += 1;
  if (jawRatio >= 0.88 && jawRatio <= 1.0) scores.oval += 1;
  if (cheekboneWidth >= foreheadWidth && cheekboneWidth >= jawWidth) scores.oval += 1;

  if (faceRatio >= 1.15 && faceRatio <= 1.3) scores.square += 1;
  if (safeDivide(Math.abs(foreheadWidth - jawWidth), cheekboneWidth) < 0.06) scores.square += 2;
  if (jawRatio >= 0.96) scores.square += 1;

  if (foreheadWidth > cheekboneWidth * 1.03) scores.heart += 2;
  if (jawWidth < cheekboneWidth * 0.92) scores.heart += 2;
  if (faceRatio >= 1.2) scores.heart += 1;

  if (cheekboneWidth > foreheadWidth * 1.05) scores.diamond += 2;
  if (cheekboneWidth > jawWidth * 1.05) scores.diamond += 2;
  if (jawRatio < 0.95) scores.diamond += 1;

  if (faceRatio > 1.42) scores.rectangle += 3;
  if (safeDivide(Math.abs(foreheadWidth - jawWidth), cheekboneWidth) < 0.08) scores.rectangle += 1;
  if (foreheadRatio >= 0.93 && foreheadRatio <= 1.05) scores.rectangle += 1;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestShape, bestScore] = sorted[0];
  const [secondShape, secondScore] = sorted[1] ?? sorted[0];

  const confidenceGap = bestScore - secondScore;
  const confidenceLabel = confidenceGap >= 2 ? "strong match" : "closest match";

  const confidenceRaw = 0.45 + bestScore * 0.07 + Math.min(confidenceGap, 3) * 0.08;
  const confidence = Math.max(0.35, Math.min(0.97, confidenceRaw));

  return {
    bestShape,
    bestScore,
    secondShape,
    secondScore,
    confidenceGap,
    confidenceLabel,
    confidence,
    ratios: {
      faceRatio,
      foreheadRatio,
      jawRatio
    },
    scores
  };
}

export function analyzeFaceMeasurements(
  measurements,
  { multipleFaces = false, forceClosest = false } = {}
) {
  if (!measurements) {
    return buildEmptyAnalysis();
  }

  const traits = classifyFaceTraits(
    measurements.faceLength,
    measurements.foreheadWidth,
    measurements.cheekboneWidth,
    measurements.jawWidth
  );
  const shapeResult = detectFaceShape(measurements);

  const confidenceLabel = multipleFaces || forceClosest ? "closest match" : shapeResult.confidenceLabel;

  return {
    isFaceDetected: true,
    faceShape: shapeResult.bestShape,
    similarFaceShape: shapeResult.secondShape,
    faceShapeConfidenceLabel: confidenceLabel,
    foreheadWidthType: traits.foreheadType,
    cheekboneWidthType: traits.cheekboneType,
    jawWidthType: traits.jawType,
    faceLengthType: traits.faceLengthType,
    confidence: confidenceLabel === "closest match" ? Math.min(0.82, shapeResult.confidence) : shapeResult.confidence,
    frontalQuality: measurements.frontalCheck,
    ratios: traits.ratios
  };
}

export function buildEmptyAnalysis() {
  return {
    isFaceDetected: false,
    faceShape: "",
    similarFaceShape: "",
    faceShapeConfidenceLabel: "",
    foreheadWidthType: "",
    cheekboneWidthType: "",
    jawWidthType: "",
    faceLengthType: "",
    confidence: 0,
    frontalQuality: null,
    ratios: null
  };
}

export function analyzeFaceLandmarks(landmarks, { multipleFaces = false } = {}) {
  const measurements = extractFaceMeasurements(landmarks);
  if (!measurements) {
    return buildEmptyAnalysis();
  }

  return analyzeFaceMeasurements(measurements, {
    multipleFaces,
    forceClosest: !measurements.isFrontal
  });
}

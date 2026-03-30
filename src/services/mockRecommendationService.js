const STYLE_CATALOG = [
  {
    name: "Textured Crop",
    faceShapes: ["oval", "round", "square"],
    lengths: ["short"],
    maintenance: ["low", "medium"],
    vibes: ["modern", "professional"],
    beard: ["no_beard", "light_beard"]
  },
  {
    name: "Classic Side Part",
    faceShapes: ["oval", "rectangle", "heart"],
    lengths: ["medium"],
    maintenance: ["low", "medium"],
    vibes: ["classic", "professional"],
    beard: ["no_beard", "light_beard"]
  },
  {
    name: "Layered Quiff",
    faceShapes: ["square", "diamond", "oval"],
    lengths: ["medium"],
    maintenance: ["medium", "high"],
    vibes: ["modern", "creative"],
    beard: ["light_beard", "full_beard"]
  },
  {
    name: "Soft Flow",
    faceShapes: ["heart", "rectangle", "diamond"],
    lengths: ["long", "medium"],
    maintenance: ["medium", "high"],
    vibes: ["creative", "modern"],
    beard: ["no_beard", "light_beard", "full_beard"]
  },
  {
    name: "Clean Buzz Fade",
    faceShapes: ["oval", "square", "diamond"],
    lengths: ["short"],
    maintenance: ["low"],
    vibes: ["classic", "professional"],
    beard: ["light_beard", "full_beard", "no_beard"]
  },
  {
    name: "Tapered Curls",
    faceShapes: ["round", "heart", "oval"],
    lengths: ["medium", "long"],
    maintenance: ["medium", "high"],
    vibes: ["creative", "modern"],
    beard: ["no_beard", "light_beard", "full_beard"]
  }
];

function scoreStyle(style, payload) {
  let score = 0;

  if (style.faceShapes.includes(payload.face_shape)) {
    score += 4;
  }

  if (style.lengths.includes(payload.preferred_hair_length)) {
    score += 3;
  }

  if (style.maintenance.includes(payload.maintenance_level)) {
    score += 2;
  }

  if (style.vibes.includes(payload.style_preference)) {
    score += 2;
  }

  if (style.beard.includes(payload.beard_preference)) {
    score += 1;
  }

  return score;
}

function readable(value) {
  return value.replace(/_/g, " ");
}

export async function getMockRecommendations(payload, context = {}) {
  await new Promise((resolve) => setTimeout(resolve, 420));

  const ranked = STYLE_CATALOG.map((style) => ({
    name: style.name,
    score: scoreStyle(style, payload)
  })).sort((a, b) => b.score - a.score);

  const [best, second, third] = ranked;

  const confidenceBase = Math.min(0.95, Math.max(0.4, best.score / 12));
  const confidence =
    context.faceShapeConfidenceLabel === "closest match"
      ? Math.max(0.32, confidenceBase - 0.12)
      : confidenceBase;

  const explanation = `Recommended because your face shape appears ${readable(
    payload.face_shape
  )} and you selected ${readable(payload.maintenance_level)} maintenance with a ${readable(
    payload.style_preference
  )} style vibe.`;

  return {
    best_match: best?.name ?? "Classic Side Part",
    alternatives: [second?.name, third?.name].filter(Boolean),
    explanation,
    confidence,
    source: "mock"
  };
}

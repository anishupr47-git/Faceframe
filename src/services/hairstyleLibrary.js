const HAIRSTYLE_SLUGS = [
  "bro_flow",
  "buzz_fade",
  "classic_crop",
  "classic_side_part",
  "curtains",
  "fringe_crop",
  "high_fade_quiff",
  "layered_crop",
  "layered_flow",
  "layered_fringe",
  "layered_volume",
  "layered_waves",
  "low_fade_crop",
  "medium_layers",
  "medium_waves",
  "messy_layers",
  "messy_quiff",
  "short_fringe",
  "side_fringe",
  "side_part",
  "side_swept_fringe",
  "side_swept_layers",
  "soft_curtains",
  "soft_quiff",
  "textured_crop",
  "textured_french_crop",
  "textured_fringe",
  "textured_quiff"
];

function toTitleCase(value) {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function normalizeHairstyleSlug(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/\s+/g, "_");
}

export const HAIRSTYLE_LIBRARY = HAIRSTYLE_SLUGS.map((slug) => ({
  slug,
  label: toTitleCase(slug)
}));

export function hairstyleLabelFromSlug(value) {
  return toTitleCase(normalizeHairstyleSlug(value));
}

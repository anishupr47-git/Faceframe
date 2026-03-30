import { useMemo, useState } from "react";
import { FiGrid, FiImage, FiSearch, FiStar } from "react-icons/fi";
import {
  HAIRSTYLE_LIBRARY,
  hairstyleLabelFromSlug,
  normalizeHairstyleSlug
} from "../services/hairstyleLibrary";

const APP_BASE = String(import.meta.env.BASE_URL || "/");

function toAssetUrl(relativePath) {
  const base = APP_BASE.endsWith("/") ? APP_BASE : `${APP_BASE}/`;
  const normalized = String(relativePath).replace(/^\/+/, "");
  return `${base}${normalized}`;
}

function buildImageCandidates(slug) {
  return [
    toAssetUrl(`${slug}.png`),
    toAssetUrl(`${slug}.webp`),
    toAssetUrl(`${slug}.jpg`),
    toAssetUrl(`${slug}.jpeg`),
    toAssetUrl(`hairstyles/previews/${slug}.png`),
    toAssetUrl(`hairstyles/previews/${slug}.webp`),
    toAssetUrl(`hairstyles/previews/${slug}.jpg`),
    toAssetUrl(`hairstyles/previews/${slug}.jpeg`)
  ];
}

function HairstyleThumb({ slug, label }) {
  const candidates = useMemo(() => buildImageCandidates(slug), [slug]);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [fallback, setFallback] = useState(false);

  const handleImageError = () => {
    if (candidateIndex < candidates.length - 1) {
      setCandidateIndex((current) => current + 1);
      return;
    }

    setFallback(true);
  };

  if (fallback) {
    return (
      <div className="style-thumb-fallback" role="img" aria-label={`${label} image placeholder`}>
        <FiImage />
      </div>
    );
  }

  return <img src={candidates[candidateIndex]} alt={label} loading="lazy" onError={handleImageError} />;
}

function buildRecommendedStyles(result) {
  if (!result) {
    return [];
  }

  const rawStyles = [];

  if (result.best_match) {
    rawStyles.push({
      slug: normalizeHairstyleSlug(result.best_match),
      tag: "Best Match"
    });
  }

  if (Array.isArray(result.alternatives)) {
    result.alternatives.slice(0, 2).forEach((style, index) => {
      rawStyles.push({
        slug: normalizeHairstyleSlug(style),
        tag: `Alternative ${index + 1}`
      });
    });
  }

  const uniqueStyles = [];
  const seenSlugs = new Set();

  rawStyles.forEach((style) => {
    if (!style.slug || seenSlugs.has(style.slug)) {
      return;
    }

    seenSlugs.add(style.slug);
    uniqueStyles.push(style);
  });

  return uniqueStyles;
}

function HairstyleLibrary({ result, loading }) {
  const [query, setQuery] = useState("");

  const recommendedStyles = useMemo(() => buildRecommendedStyles(result), [result]);

  const recommendedSlugSet = useMemo(
    () => new Set(recommendedStyles.map((item) => item.slug)),
    [recommendedStyles]
  );

  const normalizedQuery = normalizeHairstyleSlug(query);
  const filteredStyles = useMemo(() => {
    if (!normalizedQuery) {
      return HAIRSTYLE_LIBRARY;
    }

    return HAIRSTYLE_LIBRARY.filter((style) => {
      return style.slug.includes(normalizedQuery) || style.label.toLowerCase().includes(query.toLowerCase());
    });
  }, [normalizedQuery, query]);

  return (
    <section className="hairstyle-library" aria-label="Try-on hairstyle library">
      <div className="hairstyle-library-head">
        <h4>
          <FiGrid /> Style Library
        </h4>

        <label className="hairstyle-search" htmlFor="hairstyle-search">
          <FiSearch />
          <input
            id="hairstyle-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search styles"
          />
        </label>
      </div>

      {loading ? <p className="style-library-note">Preparing style previews...</p> : null}

      {!loading && recommendedStyles.length ? (
        <div className="recommended-style-row">
          {recommendedStyles.map((style) => {
            const label = hairstyleLabelFromSlug(style.slug);

            return (
              <article className="recommended-style-card" key={`${style.tag}-${style.slug}`}>
                <p className="recommended-style-tag">
                  <FiStar /> {style.tag}
                </p>
                <div className="recommended-style-image">
                  <HairstyleThumb slug={style.slug} label={label} />
                </div>
                <h5>{label}</h5>
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !recommendedStyles.length ? (
        <p className="style-library-note">Generate recommendations to pin the best-matched haircuts here.</p>
      ) : null}

      <div className="hairstyle-library-grid">
        {filteredStyles.map((style) => (
          <article
            className={`hairstyle-library-card ${recommendedSlugSet.has(style.slug) ? "is-recommended" : ""}`}
            key={style.slug}
          >
            <div className="hairstyle-library-image">
              <HairstyleThumb slug={style.slug} label={style.label} />
            </div>
            <div className="hairstyle-library-meta">
              <p>{style.label}</p>
              {recommendedSlugSet.has(style.slug) ? <span>Recommended</span> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export default HairstyleLibrary;

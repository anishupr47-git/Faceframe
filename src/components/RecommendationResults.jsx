import { FiAward, FiCheckCircle, FiLayers } from "react-icons/fi";
import HairstyleLibrary from "./HairstyleLibrary";
// import TryOnStudio from "./TryOnStudio";
// import { normalizeHairstyleSlug } from "../services/hairstyleLibrary";

function toTitle(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function RecommendationResults({ loading, result, message }) {
  // Try-on module is intentionally commented out for this MVP iteration.
  // const [showTryOn, setShowTryOn] = useState(false);
  // const suggestedStyles = useMemo(() => {
  //   if (!result) {
  //     return [];
  //   }
  //
  //   const styles = [];
  //   if (result.best_match) {
  //     styles.push(normalizeHairstyleSlug(result.best_match));
  //   }
  //
  //   if (Array.isArray(result.alternatives)) {
  //     result.alternatives.forEach((style) => {
  //       styles.push(normalizeHairstyleSlug(style));
  //     });
  //   }
  //
  //   return Array.from(new Set(styles.filter(Boolean)));
  // }, [result]);

  return (
    <section className="recommendation-results">
      <h3>Recommendation Output</h3>

      {loading ? <p className="result-status">Analyzing face profile and preference fit...</p> : null}

      {!loading && message ? <p className="result-status">{message}</p> : null}

      {!loading && result ? (
        <>
          <article className="result-card best">
            <p className="result-label">
              <FiAward /> Best Match
            </p>
            <h4>{toTitle(result.best_match)}</h4>
            <p>{result.explanation}</p>
            {typeof result.confidence === "number" ? (
              <small>Confidence: {(result.confidence * 100).toFixed(1)}%</small>
            ) : null}
          </article>

          <article className="result-card alternatives">
            <p className="result-label">
              <FiLayers /> Closest Alternatives
            </p>
            <ul>
              {result.alternatives?.map((style) => (
                <li key={style}>
                  <FiCheckCircle /> {toTitle(style)}
                </li>
              ))}
            </ul>
          </article>

          {/*
          <button
            type="button"
            className="tryon-launch-btn"
            onClick={() => setShowTryOn((current) => !current)}
          >
            {showTryOn ? "Close Try On" : "Try On Image"}
          </button>

          {showTryOn ? <TryOnStudio suggestedStyles={suggestedStyles} /> : null}
          */}
        </>
      ) : null}

      <HairstyleLibrary loading={loading} result={result} />
    </section>
  );
}

export default RecommendationResults;

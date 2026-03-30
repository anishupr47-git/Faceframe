import { FiAlertCircle, FiCheckCircle, FiInfo } from "react-icons/fi";

const FALLBACK_VALUE = "-";

function readValue(value) {
  if (!value) {
    return FALLBACK_VALUE;
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function FaceInfoSummary({ analysis, notice }) {
  const isDetected = analysis?.isFaceDetected;

  return (
    <section className="face-summary">
      <div className="face-summary-head">
        <h3>Face Analysis</h3>
        <span className={`detection-pill ${isDetected ? "ok" : "warn"}`}>
          {isDetected ? <FiCheckCircle /> : <FiAlertCircle />}
          Face detected: {isDetected ? "Yes" : "No"}
        </span>
      </div>

      {notice ? (
        <p className="face-summary-notice">
          <FiInfo /> {notice}
        </p>
      ) : null}

      <div className="face-summary-grid">
        <div>
          <span>Face shape</span>
          <strong>{readValue(analysis?.faceShape)}</strong>
          <small>{analysis?.faceShapeConfidenceLabel ? `Label: ${analysis.faceShapeConfidenceLabel}` : ""}</small>
          {analysis?.similarFaceShape ? <small>Also similar: {readValue(analysis.similarFaceShape)}</small> : null}
        </div>
        <div>
          <span>Forehead</span>
          <strong>{readValue(analysis?.foreheadWidthType)}</strong>
        </div>
        <div>
          <span>Cheekbone</span>
          <strong>{readValue(analysis?.cheekboneWidthType)}</strong>
        </div>
        <div>
          <span>Jaw</span>
          <strong>{readValue(analysis?.jawWidthType)}</strong>
        </div>
        <div>
          <span>Face length</span>
          <strong>{readValue(analysis?.faceLengthType)}</strong>
        </div>
      </div>
    </section>
  );
}

export default FaceInfoSummary;

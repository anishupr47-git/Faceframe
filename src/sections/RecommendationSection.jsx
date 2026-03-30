import { useState } from "react";
import RecommendationForm from "../components/RecommendationForm";
import RecommendationResults from "../components/RecommendationResults";
import { getHairstyleRecommendations } from "../services/recommendationApi";

function RecommendationSection({ analysis }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("Run face analysis first, then submit preferences.");

  const handleSubmit = async (preferences) => {
    if (!analysis?.isFaceDetected) {
      setResult(null);
      setMessage("No face profile available yet. Start camera analysis and keep one face in frame.");
      return;
    }

    const payload = {
      face_shape: analysis.faceShape,
      forehead_width_type: analysis.foreheadWidthType,
      cheekbone_width_type: analysis.cheekboneWidthType,
      jaw_width_type: analysis.jawWidthType,
      face_length_type: analysis.faceLengthType,
      preferred_hair_length: preferences.preferred_hair_length,
      maintenance_level: preferences.maintenance_level,
      style_preference: preferences.style_preference,
      beard_preference: preferences.beard_preference
    };

    setLoading(true);
    setResult(null);
    setMessage("Ranking hairstyle combinations...");

    try {
      const response = await getHairstyleRecommendations(payload, {
        occasion_preference: preferences.occasion_preference,
        faceShapeConfidenceLabel: analysis.faceShapeConfidenceLabel
      });

      setResult(response);
      setMessage("");
    } catch (error) {
      setResult(null);
      setMessage("Recommendation service failed. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="recommendation-section">
      <div className="recommendation-card">
        <div className="recommendation-layout">
          <RecommendationForm onSubmit={handleSubmit} loading={loading} />
          <RecommendationResults loading={loading} result={result} message={message} />
        </div>
      </div>
    </section>
  );
}

export default RecommendationSection;

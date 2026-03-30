const DEFAULT_FORM = {
  preferred_hair_length: "medium",
  maintenance_level: "low",
  style_preference: "classic",
  beard_preference: "no_beard",
  occasion_preference: "daily"
};

function RecommendationForm({ onSubmit, loading }) {
  const handleSubmit = (event) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const payload = {
      preferred_hair_length: formData.get("preferred_hair_length"),
      maintenance_level: formData.get("maintenance_level"),
      style_preference: formData.get("style_preference"),
      beard_preference: formData.get("beard_preference"),
      occasion_preference: formData.get("occasion_preference") || "daily"
    };

    onSubmit(payload);
  };

  return (
    <form className="recommendation-form" onSubmit={handleSubmit}>
      <h3>Your Preferences</h3>

      <label>
        Preferred hair length
        <select name="preferred_hair_length" defaultValue={DEFAULT_FORM.preferred_hair_length}>
          <option value="short">Short</option>
          <option value="medium">Medium</option>
          <option value="long">Long</option>
        </select>
      </label>

      <label>
        Maintenance level
        <select name="maintenance_level" defaultValue={DEFAULT_FORM.maintenance_level}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </label>

      <label>
        Style vibe
        <select name="style_preference" defaultValue={DEFAULT_FORM.style_preference}>
          <option value="classic">Classic</option>
          <option value="modern">Modern</option>
          <option value="creative">Creative</option>
          <option value="professional">Professional</option>
        </select>
      </label>

      <label>
        Beard preference
        <select name="beard_preference" defaultValue={DEFAULT_FORM.beard_preference}>
          <option value="no_beard">No beard</option>
          <option value="light_beard">Light beard</option>
          <option value="full_beard">Full beard</option>
        </select>
      </label>

      <label>
        Occasion (optional)
        <select name="occasion_preference" defaultValue={DEFAULT_FORM.occasion_preference}>
          <option value="daily">Daily</option>
          <option value="work">Work</option>
          <option value="event">Event</option>
          <option value="wedding">Wedding</option>
        </select>
      </label>

      <button type="submit" disabled={loading}>
        {loading ? "Finding matches..." : "Get Recommendations"}
      </button>
    </form>
  );
}

export default RecommendationForm;

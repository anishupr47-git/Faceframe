import { motion } from "framer-motion";
import { FiArrowRight } from "react-icons/fi";

function HeroTextPanel({ onStartClick }) {
  return (
    <motion.section
      className="hero-text-card"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
    >
      <span className="hero-badge">Browser-first face analysis</span>

      <h1>Find Hairstyle Matches That Fit Your Face And Lifestyle.</h1>

      <p>
        FaceFrame runs directly in your browser, translates landmarks into understandable face traits,
        and ranks hairstyle options based on your preferences.
      </p>

      <div className="hero-actions">
        <button type="button" className="primary-cta" onClick={onStartClick}>
          Start <FiArrowRight />
        </button>
        <span className="hero-note">No login required. Camera runs only while active.</span>
      </div>
    </motion.section>
  );
}

export default HeroTextPanel;

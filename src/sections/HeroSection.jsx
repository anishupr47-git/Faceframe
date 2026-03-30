import HeroTextPanel from "../components/HeroTextPanel";
import LiveCameraPanel from "../components/LiveCameraPanel";

function HeroSection({ onStartClick, startSignal, onAnalysisChange, liveSectionRef }) {
  return (
    <section className="hero-section" id="home">
      <div className="hero-grid">
        <HeroTextPanel onStartClick={onStartClick} />
        <div ref={liveSectionRef} id="start">
          <LiveCameraPanel startSignal={startSignal} onAnalysisChange={onAnalysisChange} />
        </div>
      </div>
    </section>
  );
}

export default HeroSection;

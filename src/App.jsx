import { useMemo, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import ModalPopup from "./components/ModalPopup";
import HeroSection from "./sections/HeroSection";
import RecommendationSection from "./sections/RecommendationSection";
import Footer from "./components/Footer";

const ABOUT_CONTENT = {
  title: "About FaceFrame",
  body: "FaceFrame is a browser-first hairstyle assistant. It reads your facial proportions from MediaPipe landmarks, converts them into simple labels, and combines them with your style preferences to recommend cuts that are easier to trust and compare."
};

const HOW_IT_WORKS_CONTENT = {
  title: "How It Works",
  steps: [
    "Start camera analysis to detect one face and estimate face-shape traits.",
    "Select your hair and style preferences in the recommendation form.",
    "FaceFrame ranks hairstyle matches and explains why they fit your profile."
  ]
};

function App() {
  const pageTopRef = useRef(null);
  const liveSectionRef = useRef(null);

  const [activeModal, setActiveModal] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [startSignal, setStartSignal] = useState(0);

  const modalContent = useMemo(() => {
    if (activeModal === "about") {
      return ABOUT_CONTENT;
    }

    if (activeModal === "how") {
      return HOW_IT_WORKS_CONTENT;
    }

    return null;
  }, [activeModal]);

  const scrollToTop = () => {
    pageTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleHomeClick = () => {
    setActiveModal(null);
    scrollToTop();
  };

  const handleStartClick = () => {
    setActiveModal(null);
    setStartSignal((current) => current + 1);
    liveSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="app-shell" ref={pageTopRef}>
      <Navbar
        onHomeClick={handleHomeClick}
        onAboutClick={() => setActiveModal("about")}
        onHowClick={() => setActiveModal("how")}
        onStartClick={handleStartClick}
      />

      <main className="main-layout">
        <HeroSection
          startSignal={startSignal}
          onStartClick={handleStartClick}
          onAnalysisChange={setAnalysis}
          liveSectionRef={liveSectionRef}
        />
        <RecommendationSection analysis={analysis} />
      </main>

      <Footer />

      <ModalPopup
        isOpen={Boolean(activeModal)}
        onClose={() => setActiveModal(null)}
        title={modalContent?.title}
        body={modalContent?.body}
        steps={modalContent?.steps}
      />
    </div>
  );
}

export default App;

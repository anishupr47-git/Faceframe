import { FiMenu, FiScissors } from "react-icons/fi";

function Navbar({ onHomeClick, onAboutClick, onHowClick, onStartClick }) {
  return (
    <header className="navbar-wrap">
      <nav className="navbar">
        <button className="brand" type="button" onClick={onHomeClick} aria-label="FaceFrame home">
          <span className="brand-icon" aria-hidden="true">
            <FiScissors />
          </span>
          <span className="brand-text">FaceFrame</span>
        </button>

        <div className="nav-links" role="navigation" aria-label="Primary navigation">
          <button type="button" onClick={onHomeClick}>
            Home
          </button>
          <button type="button" onClick={onAboutClick}>
            About
          </button>
          <button type="button" onClick={onHowClick}>
            How It Works
          </button>
          <button type="button" className="start-pill" onClick={onStartClick}>
            Start
          </button>
        </div>

        <div className="mobile-nav-icon" aria-hidden="true">
          <FiMenu />
        </div>
      </nav>
    </header>
  );
}

export default Navbar;

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/global.css";
import "./styles/app.css";
import "./styles/navbar.css";
import "./styles/modal.css";
import "./styles/hero.css";
import "./styles/live-camera.css";
import "./styles/face-summary.css";
import "./styles/recommendation.css";
import "./styles/footer.css";
import "./styles/responsive.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

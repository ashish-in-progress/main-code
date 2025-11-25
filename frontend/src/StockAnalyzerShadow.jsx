// StockAnalyzerShadow.jsx
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";
import StockDashboard from "./StockAnalyzer"; // <-- your PatternAI Pro file
import analyzerCSS from "./analyzer.css?inline"; // IMPORTANT: loads CSS as string

export default function StockAnalyzerShadow() {
  const hostRef = useRef(null);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return;

    // Create Shadow Root
    const shadow = hostRef.current.attachShadow({ mode: "open" });

    // Inject CSS inside shadow root
    const styleTag = document.createElement("style");
    styleTag.textContent = analyzerCSS;
    shadow.appendChild(styleTag);

    // Create mounting container inside shadow root
    const mountPoint = document.createElement("div");
    shadow.appendChild(mountPoint);

    // Render your StockAnalyzer dashboard inside shadow DOM
    rootRef.current = ReactDOM.createRoot(mountPoint);
    rootRef.current.render(<StockDashboard />);

    return () => {
      if (rootRef.current) {
        rootRef.current.unmount();
      }
    };
  }, []);

  return <div ref={hostRef} style={{ width: "100%", height: "100%" }} />;
}

// InsightsPage.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

axios.defaults.withCredentials = true;
axios.defaults.baseURL = "http://localhost:5000/api";

export default function InsightsPage({ onBack, userEmail: initialEmail }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [jobsList, setJobsList] = useState([]);
  const [userEmail, setUserEmail] = useState(initialEmail || "");

  useEffect(() => {
    console.log("📧 Component mounted with email:", initialEmail);
    fetchJobsList();
  }, []);

  useEffect(() => {
    console.log("📧 userEmail changed to:", userEmail);
  }, [userEmail]);

  const fetchJobsList = async () => {
    try {
      const res = await axios.get("/jobs/list");
      if (res.data.success) {
        setJobsList(res.data.jobs);
      }
    } catch (err) {
      console.error("Failed to fetch jobs list:", err);
    }
  };

  const triggerInsights = async () => {
    console.log("🔵 Button clicked!");
    console.log("📧 User email:", userEmail);
    
    if (!userEmail) {
      console.log("❌ No email provided!");
      setMessage("❌ Email is required");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      console.log("🚀 Sending request to /jobs/test-user...");
      const res = await axios.post("/jobs/test-user", { email: userEmail });
      console.log("✅ Response:", res.data);

      if (res.data.success) {
        setMessage("✅ " + res.data.message);
      } else {
        setMessage("❌ " + res.data.error);
      }
    } catch (err) {
      console.error("❌ Error details:", err);
      console.error("❌ Response data:", err.response?.data);
      setMessage("❌ Error: " + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
            📧 Stock Insights
          </h1>
          <p style={{ color: "#64748b", fontSize: "14px" }}>
            Get AI-powered analysis of your holdings delivered to your email
          </p>
        </div>

        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "10px 18px",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {/* Test Email Card */}
      <div
        style={{
          background: "white",
          borderRadius: "12px",
          padding: "24px",
          border: "1px solid #e2e8f0",
          marginBottom: "24px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: "700", marginBottom: "8px" }}>
          Test Email Insights
        </h2>
        <p style={{ color: "#64748b", marginBottom: "20px", fontSize: "14px" }}>
          Generate and send AI-powered insights immediately (don't wait for scheduled time)
        </p>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", fontSize: "13px", fontWeight: "600", marginBottom: "8px" }}>
            Email
          </label>
          <input
            type="email"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="Enter your email"
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "white",
            }}
          />
        </div>

        <button
  onClick={() => {
    console.log("🔘 Button onClick triggered");
    triggerInsights();
  }}
  style={{
    width: "100%",
    padding: "14px",
    background: "linear-gradient(135deg, #0f172a, #1e293b)",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
  }}
>
  {loading ? "⏳ Generating..." : "🚀 Generate Insights Now"}
</button>

        {/* Debug Info */}
        <div style={{ marginTop: "12px", fontSize: "11px", color: "#64748b" }}>
          Debug: Button disabled = {String(loading || !userEmail)} | Email = {userEmail || "empty"}
        </div>

        {message && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              borderRadius: "8px",
              background: message.includes("✅") ? "#d1fae5" : "#fee2e2",
              color: message.includes("✅") ? "#065f46" : "#991b1b",
              fontSize: "13px",
            }}
          >
            {message}
          </div>
        )}
      </div>

      {/* Scheduled Insights Info */}
      <div
        style={{
          background: "linear-gradient(135deg, #eff6ff, #dbeafe)",
          borderRadius: "12px",
          padding: "24px",
          border: "1px solid #93c5fd",
        }}
      >
        <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "12px", color: "#1e3a8a" }}>
          📅 Scheduled Insights
        </h3>
        <p style={{ fontSize: "13px", color: "#1e40af", marginBottom: "12px" }}>
          Automated insights are sent daily at <strong>8:00 AM IST</strong>
        </p>

        {jobsList.length > 0 && (
          <div style={{ fontSize: "12px", color: "#1e40af", marginTop: "12px" }}>
            <div style={{ fontWeight: "600", marginBottom: "8px" }}>Active Jobs:</div>
            {jobsList.map((job, idx) => (
              <div key={idx} style={{ marginLeft: "12px", marginBottom: "4px" }}>
                • {job.name}: <code>{job.schedule}</code>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: "16px", fontSize: "12px", color: "#1e40af" }}>
          <div style={{ fontWeight: "600", marginBottom: "8px" }}>You'll receive email with:</div>
          <ul style={{ marginLeft: "20px" }}>
            <li>Technical analysis (RSI, MACD, signals)</li>
            <li>Latest news for each stock via Tavily</li>
            <li>AI-generated insights and recommendations</li>
            <li>Portfolio summary and performance</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
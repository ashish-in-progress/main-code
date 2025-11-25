// PortfolioHoldings.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";

axios.defaults.withCredentials = true;
axios.defaults.baseURL = "http://localhost:5000/api";

export default function PortfolioHoldings({ onBack }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch holdings from backend (ONLY route backend provides)
  const fetchHoldings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get("/broker/holdings");

      if (response.data.success) {
        let data = response.data.holdings;

        if (Array.isArray(data)) setHoldings(data);
        else setHoldings([]);
      } else {
        setHoldings([]);
      }
    } catch (err) {
      console.error("❌ Fetch Holdings Error:", err.response?.data);
      setError(err.response?.data?.error || "Failed to fetch holdings");
      setHoldings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHoldings();
  }, []);

  // Calculations based on DB fields
  const calculateTotals = () => {
    return holdings.map((h) => {
      const qty = h.quantity || 0;
      const avg = h.average_price || 0;
      const current = h.current_price || 0;

      const total_cost = qty * avg;
      const total_value = qty * current;
      const gain_loss = total_value - total_cost;
      const gain_loss_percent =
        total_cost > 0 ? (gain_loss / total_cost) * 100 : 0;

      return {
        ...h,
        purchase_price: avg,
        total_cost,
        total_value,
        gain_loss,
        gain_loss_percent,
      };
    });
  };

  const finalHoldings = calculateTotals();

  const totalValue = finalHoldings.reduce((sum, h) => sum + h.total_value, 0);
  const totalCost = finalHoldings.reduce((sum, h) => sum + h.total_cost, 0);
  const totalGain = totalValue - totalCost;
  const totalGainPct = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;

  return (
    <div style={{ padding: "24px", maxWidth: "1400px", margin: "0 auto" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "32px",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: "700" }}>📊 My Portfolio</h1>

        {onBack && (
          <button
            onClick={onBack}
            style={{
              padding: "12px 20px",
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              fontWeight: "600",
            }}
          >
            ← Back
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "#fee2e2",
            padding: "16px",
            borderRadius: "8px",
            marginBottom: "24px",
            color: "#991b1b",
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "20px",
          marginBottom: "32px",
        }}
      >
        {/* Total Value */}
        <SummaryCard label="TOTAL VALUE" value={totalValue} />

        {/* Total Cost */}
        <SummaryCard label="TOTAL INVESTED" value={totalCost} />

        {/* P/L */}
        <SummaryCard
          label="TOTAL GAIN/LOSS"
          value={totalGain}
          percent={totalGainPct}
          highlight
        />

        {/* Count */}
        <SummaryCard label="HOLDINGS" value={finalHoldings.length} simple />
      </div>

      {/* Table */}
      {loading ? (
        <LoadingCard />
      ) : finalHoldings.length === 0 ? (
        <EmptyCard />
      ) : (
        <HoldingsTable holdings={finalHoldings} />
      )}
    </div>
  );
}

// ---- COMPONENTS ---- //

function SummaryCard({ label, value, percent, highlight, simple }) {
  const isProfit = value >= 0;
  const bg = highlight
    ? isProfit
      ? "linear-gradient(135deg,#d1fae5,#a7f3d0)"
      : "linear-gradient(135deg,#fee2e2,#fecaca)"
    : "white";

  return (
    <div
      style={{
        background: bg,
        padding: "24px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
      }}
    >
      <div style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
        {label}
      </div>

      <div style={{ fontSize: "32px", fontWeight: "700", marginTop: "8px" }}>
        {simple
          ? value
          : `₹${value.toLocaleString("en-IN", {
              minimumFractionDigits: 2,
            })}`}
      </div>

      {percent !== undefined && (
        <div
          style={{
            marginTop: "4px",
            fontSize: "14px",
            fontWeight: "600",
            color: isProfit ? "#065f46" : "#991b1b",
          }}
        >
          ({percent.toFixed(2)}%)
        </div>
      )}
    </div>
  );
}

function LoadingCard() {
  return (
    <div
      style={{
        background: "white",
        padding: "60px",
        borderRadius: "12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "48px" }}>⏳</div>
      <p style={{ color: "#64748b" }}>Loading portfolio...</p>
    </div>
  );
}

function EmptyCard() {
  return (
    <div
      style={{
        background: "white",
        padding: "60px",
        borderRadius: "12px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "64px" }}>📭</div>
      <h3>No Holdings Found</h3>
      <p style={{ color: "#64748b" }}>Authenticate broker first</p>
    </div>
  );
}

function HoldingsTable({ holdings }) {
  return (
    <div
      style={{
        background: "white",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        overflow: "hidden",
      }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#f8fafc" }}>
            <Th>STOCK</Th>
            <Th right>QTY</Th>
            <Th right>AVG</Th>
            <Th right>CURRENT</Th>
            <Th right>VALUE</Th>
            <Th right>P&L</Th>
          </tr>
        </thead>

        <tbody>
          {holdings.map((h, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
              <Td>
                <div style={{ fontWeight: "700" }}>{h.symbol}</div>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  {h.broker}
                </div>
              </Td>

              <Td right>{h.quantity}</Td>
              <Td right>₹{h.purchase_price.toFixed(2)}</Td>
              <Td right>₹{h.current_price.toFixed(2)}</Td>
              <Td right>
                ₹{h.total_value.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </Td>

              <Td right style={{ color: h.gain_loss >= 0 ? "#059669" : "#dc2626" }}>
                {h.gain_loss >= 0 ? "+" : ""}
                ₹{h.gain_loss.toFixed(2)}
                <div style={{ fontSize: "12px" }}>
                  ({h.gain_loss_percent.toFixed(2)}%)
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, right }) {
  return (
    <th
      style={{
        padding: "16px",
        textAlign: right ? "right" : "left",
        fontSize: "12px",
        fontWeight: "700",
        color: "#64748b",
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, right, style }) {
  return (
    <td
      style={{
        padding: "16px",
        textAlign: right ? "right" : "left",
        fontSize: "14px",
        fontWeight: "600",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

// Login.jsx - FULLY REWRITTEN
import React, { useState } from "react";
import API from "./api";

export default function Login({ onLogin, switchToSignup }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // ✅ CORRECT ENDPOINT: /login (not /auth/login)
      const res = await API.post("/login", { email, password });

      // Store tokens for new JWT flow
      if (res.data.accessToken) {
        localStorage.setItem('accessToken', res.data.accessToken);
        localStorage.setItem('sessionId', res.data.sessionId);
      }

      onLogin(res.data.user);
    } catch (err) {
      console.error("Login error:", err.response?.data);
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 bg-white shadow-md rounded-lg">
      <h2 className="text-2xl font-bold mb-6 text-center">Login</h2>
      
      <form onSubmit={handleLogin} className="space-y-4">
        <input
          className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="w-full border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        
        <button
          type="button"
          onClick={switchToSignup}
          className="w-full text-blue-600 underline text-sm mt-2 hover:text-blue-800"
        >
          Create an account
        </button>
      </form>
      
      {error && (
        <p className="text-red-500 mt-3 text-center">{error}</p>
      )}
    </div>
  );
}

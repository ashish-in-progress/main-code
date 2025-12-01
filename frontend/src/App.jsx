// App.jsx - FULLY REWRITTEN
import React, { useEffect, useState } from "react";
import API from "./api.js";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import MainApp from "./MainApp";
import "./App.css";

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState("login");

  useEffect(() => {
    async function checkSession() {
      try {
        const res = await API.get("/me");
        setUser(res.data.user);
      } catch (err) {
        // ✅ Suppress expected "Not logged in" errors
        if (err.response?.status !== 401) {
          console.error("Session check failed:", err.response?.data);
        }
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    checkSession();
  }, []);

  const handleLogout = async () => {
    try {
      await API.post("/logout");
    } catch (e) {
      console.error("Logout error:", e);
    }
    
    // Clear all storage
    localStorage.removeItem('accessToken');
    localStorage.removeItem('sessionId');
    setUser(null);
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <h1 className="text-center text-xl">Loading...</h1>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        {authMode === "login" ? (
          <Login onLogin={handleLoginSuccess} switchToSignup={() => setAuthMode("signup")} />
        ) : (
          <Signup switchToLogin={() => setAuthMode("login")} />
        )}
      </div>
    );
  }

  return (
    <MainApp 
      user={user} 
      onLogout={handleLogout} 
    />
  );
}

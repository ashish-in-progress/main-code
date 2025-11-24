import React, { useEffect, useState } from "react";
import API from "./api.js";
import Login from "./Login.jsx";
import Signup from "./Signup.jsx";
import MainApp from "./MainApp";

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
        console.error("Session check failed:", err.response?.data);
        setUser(null);
      }
      setLoading(false);
    }
    checkSession();
  }, []);

  const handleLogout = async () => {
    await API.post("/logout");
    setUser(null);
  };

  if (loading) {
    return <h1 className="text-center mt-10 text-xl">Loading...</h1>;
  }

  if (user) {
    return <MainApp user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100">
      {authMode === "login" ? (
        <Login 
          onLogin={setUser} 
          switchToSignup={() => setAuthMode("signup")} 
        />
      ) : (
        <Signup 
          switchToLogin={() => setAuthMode("login")} 
        />
      )}
    </div>
  );
}

import React, { useState } from "react";
import API from "./api";

export default function Signup({ switchToLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();

    try {
      await API.post("/signup", { 
        email, 
        password 
      });

      setMessage("Account created. You can login now.");
    } catch (err) {
      const msg = err.response?.data?.message || "Signup failed";
      setMessage(msg);
    }
  };

  return (
    <div className="max-w-sm mx-auto p-6 bg-white shadow-md rounded-lg mt-10">
      <h2 className="text-2xl font-bold mb-4 text-center">Signup</h2>

      <form onSubmit={handleSignup} className="space-y-4">
        <input
          className="w-full border px-3 py-2 rounded-md"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <input
          type="password"
          className="w-full border px-3 py-2 rounded-md"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button
          type="submit"
          className="w-full bg-green-600 text-white py-2 rounded-md hover:bg-green-700 transition"
        >
          Signup
        </button>

        <button
          type="button"
          onClick={switchToLogin}
          className="w-full text-blue-600 underline text-sm mt-2"
        >
          Already have an account?
        </button>
      </form>

      {message && <p className="text-center text-gray-700 mt-3">{message}</p>}
    </div>
  );
}

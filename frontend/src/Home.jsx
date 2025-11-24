import React from "react";

export default function Home({ user, onLogout }) {
  return (
    <div className="max-w-sm mx-auto p-6 bg-white shadow-md rounded-lg mt-10 text-center">
      <h2 className="text-2xl font-bold mb-4">
        Welcome, <span className="text-blue-600">{user.username}</span>
      </h2>

      <button
        className="mt-4 w-full bg-red-600 text-white py-2 rounded-md hover:bg-red-700 transition"
        onClick={onLogout}
      >
        Logout
      </button>
      
    </div>
  );
}

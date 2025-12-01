// api.js - FULL JWT + AUTO-REFRESH
import axios from "axios";

const API = axios.create({
  baseURL: "https://33trpk9t-5000.inc1.devtunnels.ms",
  withCredentials: true, // refreshToken cookie
});

// Auto-add tokens to ALL requests
API.interceptors.request.use((config) => {
  const accessToken = localStorage.getItem('accessToken');
  const sessionId = localStorage.getItem('sessionId');
  
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  if (sessionId) config.headers['X-Session-Id'] = sessionId;
  
  return config;
});

// Auto-refresh on 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && 
        error.response?.data?.refreshRequired && 
        !originalRequest._retry) {
      
      originalRequest._retry = true;
      
      try {
        const { data } = await API.post('/auth/refresh');
        localStorage.setItem('accessToken', data.accessToken);
        return API(originalRequest);
      } catch (refreshError) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('sessionId');
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

export default API;

import axios from "axios";

const API = axios.create({
  baseURL: "https://33trpk9t-5000.inc1.devtunnels.ms",
  withCredentials: true, // IMPORTANT for sessions
});

export default API;

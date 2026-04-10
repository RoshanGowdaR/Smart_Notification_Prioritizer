import axios from "axios";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

client.interceptors.request.use((config) => {
  if (import.meta.env.DEV) {
    const method = (config.method || "GET").toUpperCase();
    console.log(`[API] ${method} ${config.baseURL || ""}${config.url || ""}`);
  }
  return config;
});

export default client;

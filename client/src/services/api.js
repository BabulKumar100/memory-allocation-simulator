import axios from "axios";
import { simulateAllocation } from "@shared/allocation.js";

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api", timeout: 10000 });

export async function runSimulation(payload) {
  try {
    const { data } = await api.post("/simulate", payload);
    return data;
  } catch (error) {
    // Local fallback keeps the UI usable if the backend hasn't been started yet.
    // Yeh wahi shared module hai jo backend use karta hai, isliye result identical rehta hai.
    if (error.code === "ERR_NETWORK" || error.response?.status >= 500) {
      return simulateAllocation(payload);
    }
    throw new Error(error.response?.data?.message || error.message || "Unable to simulate.");
  }
}
export default api;

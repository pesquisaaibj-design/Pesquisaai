import axios from "axios";

const rawBackendUrl = (process.env.REACT_APP_BACKEND_URL || "").trim();
// In production REACT_APP_BACKEND_URL should point to the Render backend.
// Falling back to the current origin avoids generating "undefined/api" URLs.
const BACKEND_URL = rawBackendUrl.replace(/\/$/, "") || window.location.origin;
export const API = `${BACKEND_URL}/api`;

export function photoSrc(url) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${BACKEND_URL}${path}`;
}

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("pa_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export function buildWhatsappLink(whatsapp, query) {
  const digits = (whatsapp || "").replace(/\D/g, "");
  const number = digits.startsWith("55") ? digits : `55${digits}`;
  const msg = query
    ? `Olá! Encontrei sua loja pela PesquisaAí e estou procurando ${query}. Vocês têm esse produto disponível?`
    : `Olá! Encontrei sua loja pela PesquisaAí e gostaria de mais informações.`;
  return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
}

export function buildMapsLink(store) {
  if (store.maps_url) return store.maps_url;
  const q = [store.address, store.neighborhood, store.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function buildInstagramLink(instagram) {
  if (!instagram) return "";
  if (instagram.startsWith("http")) return instagram;
  return `https://instagram.com/${instagram.replace(/^@/, "")}`;
}

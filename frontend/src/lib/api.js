import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

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

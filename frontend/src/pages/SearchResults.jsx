import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { StoreCard } from "@/components/StoreCard";

function normalizeText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function productObject(product, index) {
  if (product && typeof product === "object") {
    return {
      ...product,
      id: product.id || `legacy-${index}`,
      name: String(product.name || ""),
      category: String(product.category || ""),
    };
  }
  return { id: `legacy-${index}`, name: String(product || ""), category: "" };
}

function filterStoresLocally(stores, query) {
  const tokens = normalizeText(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  return (Array.isArray(stores) ? stores : [])
    .map((store) => {
      const products = (Array.isArray(store.products) ? store.products : [])
        .map(productObject)
        .filter((p) => p.name);
      const matchedProducts = products.filter((p) => {
        const text = normalizeText(`${p.name} ${p.category}`);
        return tokens.every((token) => text.includes(token));
      });
      const storeText = normalizeText(`${store.name || ""} ${store.description || ""} ${store.category || ""}`);
      const storeMatches = tokens.every((token) => storeText.includes(token));
      if (!matchedProducts.length && !storeMatches) return null;
      return { ...store, products, matched_products: matchedProducts };
    })
    .filter(Boolean)
    .sort((a, b) => Number(Boolean(b.isPartner)) - Number(Boolean(a.isPartner)));
}

export default function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const navigate = useNavigate();
  const [q, setQ] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setQ(query);
    setLoading(true);
    setError("");
    const controller = new AbortController();
    // The admin already reads /stores successfully. Use that same public source here
    // and filter on the client, so the public search cannot get out of sync with
    // a separately deployed /search endpoint.
    api
      .get(`/stores`, { signal: controller.signal, timeout: 15000 })
      .then((res) => {
        const stores = Array.isArray(res.data) ? res.data : [];
        setResults(filterStoresLocally(stores, query));
      })
      .catch((err) => {
        if (err.code === "ERR_CANCELED") return;
        setResults([]);
        const detail = err.response?.data?.detail;
        setError(typeof detail === "string" ? detail : "Não foi possível carregar a busca. Tente novamente.");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [query]);

  const submit = (e) => {
    e.preventDefault();
    const val = q.trim();
    if (val) navigate(`/buscar?q=${encodeURIComponent(val)}`);
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-3">
          <Logo size={24} withText={false} />
          <form onSubmit={submit} className="relative flex-1">
            <Search
              size={18}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#FF5A00]"
            />
            <input
              data-testid="search-input"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="O que você está procurando?"
              className="h-12 w-full rounded-full border border-gray-200 pl-11 pr-4 text-base outline-none transition-colors focus:border-[#FF5A00]"
            />
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-6">
        <h1
          data-testid="results-title"
          className="font-display text-2xl font-bold tracking-tight text-[#111111]"
        >
          Resultados para “{query}”
        </h1>

        {loading ? (
          <div className="mt-8 space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-[#FAFAFA]" />
            ))}
          </div>
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-5 text-center">
            <p className="font-display font-semibold text-red-700">Erro ao carregar os produtos</p>
            <p className="mt-1 text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-xl bg-[#111111] px-4 py-2 text-sm font-semibold text-white"
            >
              Tentar novamente
            </button>
          </div>
        ) : results.length === 0 ? (
          <div
            data-testid="no-results"
            className="mt-16 flex flex-col items-center text-center"
          >
            <SearchX size={48} className="text-gray-300" />
            <p className="mt-4 font-display text-lg font-semibold text-[#111111]">
              Nenhuma loja encontrada
            </p>
            <p className="mt-1 text-sm text-[#525252]">
              Tente pesquisar com outras palavras.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-1 text-sm text-[#525252]">
              {results.length} {results.length === 1 ? "loja encontrada" : "lojas encontradas"}
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4">
              {results.map((store) => (
                <StoreCard key={store.id} store={store} query={query} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

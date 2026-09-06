import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Search, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { StoreCard } from "@/components/StoreCard";

export default function SearchResults() {
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const navigate = useNavigate();
  const [q, setQ] = useState(query);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQ(query);
    setLoading(true);
    api
      .get(`/search`, { params: { q: query } })
      .then((res) => setResults(res.data.results || []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
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

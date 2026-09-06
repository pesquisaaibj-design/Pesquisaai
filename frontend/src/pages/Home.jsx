import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function Home() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  const submit = (e) => {
    e.preventDefault();
    const query = q.trim();
    if (query) navigate(`/buscar?q=${encodeURIComponent(query)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white px-6">
      <header className="flex items-center justify-between py-5">
        <Logo size={26} />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
        <div className="fade-in w-full max-w-xl">
          <div className="mx-auto mb-6 inline-flex h-20 w-20 items-center justify-center rounded-3xl border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
            <Search size={44} strokeWidth={2.6} color="#FF5A00" />
          </div>

          <h1 className="font-display text-4xl font-semibold leading-none tracking-tight text-[#111111] sm:text-5xl">
            Pesquisa<span className="text-[#FF5A00]">Aí</span>
          </h1>
          <p className="mt-3 text-base font-normal text-[#525252] sm:text-lg">
            Pesquisou. Achou. Acabou.
          </p>

          <form onSubmit={submit} className="mt-8">
            <div className="relative">
              <Search
                size={22}
                className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[#FF5A00]"
              />
              <input
                data-testid="search-input"
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="O que você está procurando?"
                className="h-16 w-full rounded-2xl border-2 border-gray-200 pl-14 pr-4 text-base text-[#111111] outline-none transition-colors placeholder:text-gray-400 focus:border-[#FF5A00]"
              />
            </div>
            <button
              data-testid="search-submit-button"
              type="submit"
              className="mt-4 h-14 w-full rounded-2xl bg-[#FF5A00] text-base font-semibold text-white transition-all duration-200 hover:bg-[#E04F00] active:scale-[0.98]"
            >
              Pesquisar
            </button>
          </form>

          <p className="mt-6 text-sm text-[#525252]">
            Encontre lojas e produtos em Belo Jardim.
          </p>
        </div>
      </main>
    </div>
  );
}

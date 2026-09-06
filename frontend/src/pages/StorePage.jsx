import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { MessageCircle, Instagram, MapPin, Clock, ArrowLeft, Facebook, Music2 } from "lucide-react";
import { api, buildWhatsappLink, buildMapsLink, buildInstagramLink, photoSrc } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { PartnerBadge } from "@/components/StoreCard";

export default function StorePage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const query = params.get("q") || "";
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get(`/stores/${id}`)
      .then((res) => setStore(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading)
    return <div className="mx-auto max-w-2xl px-5 py-10"><div className="h-64 animate-pulse rounded-2xl bg-[#FAFAFA]" /></div>;

  if (error || !store)
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <p className="font-display text-lg font-semibold">Loja não encontrada</p>
        <Link to="/" className="mt-4 inline-block text-[#FF5A00]">Voltar ao início</Link>
      </div>
    );

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
          <Logo size={24} />
          <button
            data-testid="back-button"
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-1 text-sm text-[#525252] hover:text-[#111111]"
          >
            <ArrowLeft size={16} /> Voltar
          </button>
        </div>
      </header>

      <main className="fade-in mx-auto max-w-2xl px-5 py-8">
        {store.photo_url && (
          <div
            data-testid="store-photo"
            className="mb-6 overflow-hidden rounded-2xl border border-gray-200"
          >
            <img
              src={photoSrc(store.photo_url)}
              alt={`Fachada da ${store.name}`}
              className="h-52 w-full object-cover sm:h-64"
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              data-testid="store-name"
              className="font-display text-3xl font-semibold tracking-tight text-[#111111]"
            >
              {store.name}
            </h1>
            {store.category && <p className="mt-1 text-[#525252]">{store.category}</p>}
          </div>
          {store.isPartner && <PartnerBadge />}
        </div>

        {store.description && (
          <p className="mt-4 text-[#525252]">{store.description}</p>
        )}

        {/* Contact buttons */}
        <div className="mt-6 flex flex-wrap gap-2">
          {store.whatsapp && (
            <a
              data-testid="store-whatsapp-button"
              href={buildWhatsappLink(store.whatsapp, query)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-95"
            >
              <MessageCircle size={17} /> Falar no WhatsApp
            </a>
          )}
          {store.instagram && (
            <a
              data-testid="store-instagram-button"
              href={buildInstagramLink(store.instagram)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-5 py-3 text-sm font-semibold text-white transition-transform duration-200 active:scale-95"
            >
              <Instagram size={17} /> Instagram
            </a>
          )}
          {(store.maps_url || store.address || store.neighborhood) && (
            <a
              data-testid="store-maps-button"
              href={buildMapsLink(store)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#FAFAFA]"
            >
              <MapPin size={17} /> Como chegar
            </a>
          )}
          {store.facebook && (
            <a
              data-testid="store-facebook-button"
              href={store.facebook.startsWith("http") ? store.facebook : `https://facebook.com/${store.facebook}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#FAFAFA]"
            >
              <Facebook size={17} /> Facebook
            </a>
          )}
          {store.tiktok && (
            <a
              data-testid="store-tiktok-button"
              href={store.tiktok.startsWith("http") ? store.tiktok : `https://tiktok.com/@${store.tiktok.replace(/^@/, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#FAFAFA]"
            >
              <Music2 size={17} /> TikTok
            </a>
          )}
        </div>

        {/* Products */}
        {store.products?.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-semibold tracking-tight text-[#111111]">
              Produtos e categorias
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {store.products.map((p) => (
                <span
                  key={p.id}
                  data-testid="store-product-chip"
                  className="rounded-full border border-gray-200 bg-[#FAFAFA] px-3.5 py-1.5 text-sm text-[#525252]"
                >
                  {p.name}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Info */}
        <section className="mt-10">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[#111111]">
            Informações
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            {(store.address || store.neighborhood || store.city) && (
              <p className="flex items-start gap-2 text-[#525252]">
                <MapPin size={16} className="mt-0.5 shrink-0 text-[#FF5A00]" />
                {[store.address, store.neighborhood, store.city].filter(Boolean).join(", ")}
              </p>
            )}
            {store.hours && (
              <p className="flex items-start gap-2 text-[#525252]">
                <Clock size={16} className="mt-0.5 shrink-0 text-[#FF5A00]" />
                {store.hours}
              </p>
            )}
            {!store.address && !store.neighborhood && !store.hours && (
              <p className="text-[#525252]">Informações em breve.</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

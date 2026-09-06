import { MessageCircle, Instagram, MapPin, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { buildWhatsappLink, buildMapsLink, buildInstagramLink } from "@/lib/api";

export function PartnerBadge() {
  return (
    <span
      data-testid="partner-badge"
      className="inline-flex items-center gap-1 rounded-full bg-[#FFF0E5] px-3 py-1 text-xs font-bold text-[#FF5A00]"
    >
      <Star size={12} fill="#FF5A00" strokeWidth={0} /> Parceiro PesquisaAí
    </span>
  );
}

export function StoreCard({ store, query = "" }) {
  const matched = store.matched_products || [];
  const preview = matched.length ? matched : (store.products || []);

  return (
    <div
      data-testid="store-card"
      className="fade-in rounded-2xl border border-gray-200 bg-white p-5 transition-transform duration-200 active:scale-[0.99] hover:shadow-[0_8px_30px_rgb(0,0,0,0.05)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link to={`/loja/${store.id}`} data-testid="store-card-name-link">
            <h2 className="font-display text-xl font-semibold tracking-tight text-[#111111] sm:text-2xl hover:text-[#FF5A00] transition-colors">
              {store.name}
            </h2>
          </Link>
          {store.category && (
            <p className="mt-0.5 text-sm text-[#525252]">{store.category}</p>
          )}
        </div>
        {store.isPartner && <PartnerBadge />}
      </div>

      {preview.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {preview.slice(0, 6).map((p) => (
            <span
              key={p.id}
              className="rounded-full bg-[#FAFAFA] border border-gray-200 px-3 py-1 text-xs text-[#525252]"
            >
              {p.name}
            </span>
          ))}
          {preview.length > 6 && (
            <span className="rounded-full px-2 py-1 text-xs text-[#525252]">
              +{preview.length - 6}
            </span>
          )}
        </div>
      )}

      {(store.neighborhood || store.address || store.city) && (
        <p className="mt-4 flex items-center gap-1.5 text-sm text-[#525252]">
          <MapPin size={15} className="text-[#FF5A00]" />
          {[store.neighborhood, store.city].filter(Boolean).join(" · ") || store.address}
        </p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {store.whatsapp && (
          <a
            data-testid="store-card-whatsapp-button"
            href={buildWhatsappLink(store.whatsapp, query)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 active:scale-95"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
        )}
        {store.instagram && (
          <a
            data-testid="store-card-instagram-button"
            href={buildInstagramLink(store.instagram)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 active:scale-95"
          >
            <Instagram size={16} /> Instagram
          </a>
        )}
        <a
          data-testid="store-card-maps-button"
          href={buildMapsLink(store)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#FAFAFA]"
        >
          <MapPin size={16} /> Como chegar
        </a>
      </div>
    </div>
  );
}

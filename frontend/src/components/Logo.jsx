import { Search } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo({ size = 28, withText = true, className = "" }) {
  return (
    <Link
      to="/"
      data-testid="logo-link"
      className={`inline-flex items-center gap-2 select-none ${className}`}
    >
      <span className="inline-flex items-center justify-center rounded-xl bg-white">
        <Search size={size} strokeWidth={2.6} color="#FF5A00" />
      </span>
      {withText && (
        <span className="font-display font-semibold tracking-tight text-[#111111]">
          Pesquisa<span className="text-[#FF5A00]">Aí</span>
        </span>
      )}
    </Link>
  );
}

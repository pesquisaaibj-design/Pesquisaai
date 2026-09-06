import { useEffect, useState } from "react";
import { api, photoSrc } from "@/lib/api";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, LogOut, Star, X, Save, Search, ImageIcon, Upload, Loader2,
} from "lucide-react";

function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("pa_token", data.token);
      onLogin();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="mb-8 flex justify-center"><Logo size={30} /></div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#111111]">
          Painel administrativo
        </h1>
        <p className="mt-1 text-sm text-[#525252]">Entre para gerenciar as lojas.</p>

        <input
          data-testid="admin-email-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="mt-6 h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#FF5A00]"
        />
        <input
          data-testid="admin-password-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Senha"
          className="mt-3 h-12 w-full rounded-xl border border-gray-200 px-4 outline-none focus:border-[#FF5A00]"
        />
        {error && <p data-testid="admin-login-error" className="mt-3 text-sm text-red-500">{error}</p>}
        <button
          data-testid="admin-login-button"
          disabled={loading}
          className="mt-5 h-12 w-full rounded-xl bg-[#FF5A00] font-semibold text-white transition-colors hover:bg-[#E04F00] disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}

const EMPTY = {
  name: "", description: "", category: "", address: "", neighborhood: "",
  city: "Belo Jardim - PE", whatsapp: "", instagram: "", facebook: "",
  tiktok: "", maps_url: "", hours: "", isPartner: false, photo_url: "", products: [],
};

function StoreForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial }));
  const [productsText, setProductsText] = useState(
    (initial?.products || []).map((p) => p.name).join("\n")
  );
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const uploadPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post("/admin/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setForm((f) => ({ ...f, photo_url: data.url }));
      toast.success("Foto enviada");
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === "string" ? detail : "Erro ao enviar foto");
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error("Nome da loja é obrigatório"); return; }
    setSaving(true);
    const products = productsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((name) => {
        const existing = (initial?.products || []).find((p) => p.name === name);
        return existing || { name, category: "" };
      });
    const payload = { ...form, products };
    delete payload.id;
    delete payload.matched_products;
    try {
      if (initial?.id) {
        await api.put(`/admin/stores/${initial.id}`, payload);
      } else {
        await api.post(`/admin/stores`, payload);
      }
      toast.success("Loja salva");
      onSaved();
    } catch (err) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const field = (label, key, type = "text") => (
    <div>
      <label className="text-xs font-semibold text-[#525252]">{label}</label>
      <input
        data-testid={`store-form-${key}`}
        type={type}
        value={form[key] || ""}
        onChange={set(key)}
        className="mt-1 h-11 w-full rounded-xl border border-gray-200 px-3 outline-none focus:border-[#FF5A00]"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {initial?.id ? "Editar loja" : "Nova loja"}
          </h2>
          <button data-testid="store-form-close" onClick={onClose} className="rounded-full p-2 hover:bg-[#FAFAFA]">
            <X size={20} />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[#525252]">Foto da fachada</label>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-[#FAFAFA]">
                {form.photo_url ? (
                  <img
                    data-testid="store-form-photo-preview"
                    src={photoSrc(form.photo_url)}
                    alt="Fachada"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon size={28} className="text-gray-300" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <label
                  data-testid="store-form-photo-upload"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-[#111111] hover:bg-[#FAFAFA]"
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                  {form.photo_url ? "Trocar foto" : "Enviar foto"}
                  <input type="file" accept="image/*" onChange={uploadPhoto} className="hidden" disabled={uploading} />
                </label>
                {form.photo_url && (
                  <button
                    type="button"
                    data-testid="store-form-photo-remove"
                    onClick={() => setForm((f) => ({ ...f, photo_url: "" }))}
                    className="text-left text-xs font-medium text-red-500"
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>
          {field("Nome *", "name")}
          {field("Categoria / posicionamento", "category")}
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[#525252]">Descrição</label>
            <textarea
              data-testid="store-form-description"
              value={form.description}
              onChange={set("description")}
              rows={2}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 outline-none focus:border-[#FF5A00]"
            />
          </div>
          {field("WhatsApp (com DDD)", "whatsapp")}
          {field("Instagram (@ ou URL)", "instagram")}
          {field("Facebook", "facebook")}
          {field("TikTok", "tiktok")}
          {field("Endereço", "address")}
          {field("Bairro", "neighborhood")}
          {field("Cidade", "city")}
          {field("Horário de funcionamento", "hours")}
          <div className="sm:col-span-2">{field("Link do Google Maps", "maps_url")}</div>
          <div className="sm:col-span-2">
            <label className="text-xs font-semibold text-[#525252]">
              Produtos / categorias (um por linha)
            </label>
            <textarea
              data-testid="store-form-products"
              value={productsText}
              onChange={(e) => setProductsText(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-xl border border-gray-200 p-3 font-mono text-sm outline-none focus:border-[#FF5A00]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 sm:col-span-2">
            <input
              data-testid="store-form-partner"
              type="checkbox"
              checked={form.isPartner}
              onChange={(e) => setForm({ ...form, isPartner: e.target.checked })}
              className="h-5 w-5 accent-[#FF5A00]"
            />
            <span className="text-sm font-medium text-[#111111]">Loja parceira</span>
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={onClose} className="h-12 flex-1 rounded-xl border border-gray-200 font-semibold">
            Cancelar
          </button>
          <button
            data-testid="store-form-save"
            onClick={save}
            disabled={saving}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF5A00] font-semibold text-white hover:bg-[#E04F00] disabled:opacity-60"
          >
            <Save size={17} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onLogout }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/stores").then((r) => setStores(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const del = async (store) => {
    try {
      await api.delete(`/admin/stores/${store.id}`);
      toast.success("Loja excluída");
      setConfirmDelete(null);
      load();
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4">
          <Logo size={24} />
          <button
            data-testid="admin-logout-button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 text-sm text-[#525252] hover:text-[#111111]"
          >
            <LogOut size={16} /> Sair
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Lojas</h1>
            <p className="text-sm text-[#525252]">{stores.length} cadastradas</p>
          </div>
          <button
            data-testid="admin-add-store-button"
            onClick={() => setEditing(EMPTY)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF5A00] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#E04F00]"
          >
            <Plus size={17} /> Adicionar loja
          </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-[#FAFAFA]" />)}
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {stores.map((store) => (
              <div
                key={store.id}
                data-testid="admin-store-row"
                className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display font-semibold text-[#111111]">{store.name}</p>
                    {store.isPartner && (
                      <Star size={15} fill="#FF5A00" strokeWidth={0} />
                    )}
                  </div>
                  <p className="truncate text-sm text-[#525252]">
                    {store.category || "—"} · {store.products?.length || 0} produtos
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    data-testid="admin-edit-store-button"
                    onClick={() => setEditing(store)}
                    className="rounded-xl border border-gray-200 p-2.5 hover:bg-[#FAFAFA]"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    data-testid="admin-delete-store-button"
                    onClick={() => setConfirmDelete(store)}
                    className="rounded-xl border border-gray-200 p-2.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {editing && (
        <StoreForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6">
            <p className="font-display text-lg font-bold">Excluir loja?</p>
            <p className="mt-1 text-sm text-[#525252]">
              “{confirmDelete.name}” será removida permanentemente.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="h-11 flex-1 rounded-xl border border-gray-200 font-semibold"
              >
                Cancelar
              </button>
              <button
                data-testid="admin-confirm-delete-button"
                onClick={() => del(confirmDelete)}
                className="h-11 flex-1 rounded-xl bg-red-500 font-semibold text-white"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(null);

  const check = () => {
    const token = localStorage.getItem("pa_token");
    if (!token) { setAuthed(false); return; }
    api.get("/auth/me").then(() => setAuthed(true)).catch(() => {
      localStorage.removeItem("pa_token");
      setAuthed(false);
    });
  };
  useEffect(check, []);

  const logout = () => {
    localStorage.removeItem("pa_token");
    setAuthed(false);
  };

  if (authed === null)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Search className="animate-pulse text-[#FF5A00]" size={40} />
      </div>
    );

  return authed ? <Dashboard onLogout={logout} /> : <LoginView onLogin={() => setAuthed(true)} />;
}

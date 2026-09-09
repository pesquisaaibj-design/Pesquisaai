from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional
import logging
import uuid
import unicodedata
import difflib
import bcrypt
import jwt
import requests
from datetime import datetime, timezone, timedelta
from bson.binary import Binary

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

# ---------- Object storage ----------
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")
APP_NAME = "pesquisaai"
MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
    "gif": "image/gif", "webp": "image/webp",
}
storage_key = None


def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120,
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120,
        )
    resp.raise_for_status()
    return resp.json()


def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------- Models ----------
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    category: str = ""


class Store(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    category: str = ""
    address: str = ""
    neighborhood: str = ""
    city: str = "Belo Jardim - PE"
    whatsapp: str = ""
    instagram: str = ""
    facebook: str = ""
    tiktok: str = ""
    maps_url: str = ""
    hours: str = ""
    isPartner: bool = False
    photo_url: str = ""
    products: List[Product] = Field(default_factory=list)


class StoreInput(BaseModel):
    name: str
    description: str = ""
    category: str = ""
    address: str = ""
    neighborhood: str = ""
    city: str = "Belo Jardim - PE"
    whatsapp: str = ""
    instagram: str = ""
    facebook: str = ""
    tiktok: str = ""
    maps_url: str = ""
    hours: str = ""
    isPartner: bool = False
    photo_url: str = ""
    products: List[Product] = Field(default_factory=list)


class LoginInput(BaseModel):
    email: str
    password: str


# ---------- Auth helpers ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=12),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if not creds:
        raise HTTPException(status_code=401, detail="Não autenticado")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"email": payload.get("email")})
        if not user:
            raise HTTPException(status_code=401, detail="Usuário não encontrado")
        return {"email": user["email"], "role": user.get("role", "admin")}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sessão expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


# ---------- Search helpers ----------
def normalize(text: str) -> str:
    text = text.lower().strip()
    text = unicodedata.normalize("NFKD", text)
    text = "".join(c for c in text if not unicodedata.combining(c))
    return text


STOPWORDS = {"de", "da", "do", "das", "dos", "para", "pra", "com", "e", "a", "o",
             "os", "as", "em", "no", "na", "um", "uma"}

SYNONYMS = {
    "bebe": {"bebe", "baby"},
    "baby": {"bebe", "baby"},
    "roupa": {"roupa", "moda", "roupas"},
    "roupas": {"roupa", "moda", "roupas"},
    "moda": {"moda", "roupa"},
    "crianca": {"crianca", "infantil", "kids"},
    "infantil": {"infantil", "crianca", "kids"},
    "sapato": {"sapato", "calcado", "tenis"},
    "calcado": {"calcado", "sapato"},
    "oculos": {"oculos", "oculo"},
    "biquini": {"biquini", "biquinis", "maio", "praia"},
}


def stem(token: str) -> str:
    if len(token) > 3 and token.endswith("s"):
        return token[:-1]
    return token


def expand_token(token: str):
    variants = SYNONYMS.get(token, {token})
    variants = set(variants) | {stem(v) for v in variants}
    return variants


def token_matches_text(qtoken: str, text_tokens) -> bool:
    qvariants = expand_token(qtoken)
    for tt in text_tokens:
        st = stem(tt)
        for qv in qvariants:
            if qv == tt or qv in tt or tt in qv or qv == st:
                return True
            if len(qv) >= 4 and difflib.SequenceMatcher(None, qv, tt).ratio() >= 0.82:
                return True
    return False


def product_to_dict(product, index: int = 0) -> dict:
    """Accept both the current product object format and legacy string products."""
    if isinstance(product, dict):
        name = str(product.get("name", "") or "").strip()
        return {
            **product,
            "id": product.get("id") or f"legacy-{index}",
            "name": name,
            "category": str(product.get("category", "") or ""),
        }
    name = str(product or "").strip()
    return {"id": f"legacy-{index}", "name": name, "category": ""}


def normalized_products(store: dict) -> list:
    raw = store.get("products") or []
    if not isinstance(raw, list):
        raw = [raw]
    return [product_to_dict(p, i) for i, p in enumerate(raw) if str(p or "").strip()]


def score_store(store: dict, qtokens):
    products = normalized_products(store)
    haystack = " ".join([
        str(store.get("name", "") or ""),
        str(store.get("description", "") or ""),
        str(store.get("category", "") or ""),
        " ".join(p.get("name", "") for p in products),
        " ".join(p.get("category", "") for p in products),
    ])
    text_tokens = normalize(haystack).split()

    matched_products = []
    for p in products:
        # Search both product name and product category.
        p_tokens = normalize(f"{p.get('name', '')} {p.get('category', '')}").split()
        if all(token_matches_text(qt, p_tokens) for qt in qtokens):
            matched_products.append(p)

    matched_count = sum(1 for qt in qtokens if token_matches_text(qt, text_tokens))
    all_match = matched_count == len(qtokens)

    score = 0
    if matched_products:
        score += 100 + len(matched_products)
    if all_match:
        score += 50
    else:
        score += matched_count * 10
    if store.get("isPartner"):
        score += 5
    return score, matched_products, all_match


# ---------- Public routes ----------
@api_router.get("/")
async def root():
    return {"message": "PesquisaAí API"}


@api_router.get("/stores")
async def list_stores():
    stores = await db.stores.find({}, {"_id": 0}).to_list(1000)
    for store in stores:
        store["products"] = normalized_products(store)
    stores.sort(key=lambda s: (not s.get("isPartner"), s.get("name", "")))
    return stores


@api_router.get("/stores/{store_id}")
async def get_store(store_id: str):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    store["products"] = normalized_products(store)
    return store


@api_router.get("/search")
async def search(q: str = ""):
    q = q.strip()
    if not q:
        return {"query": q, "results": []}
    qtokens = [t for t in normalize(q).split() if t and t not in STOPWORDS]
    if not qtokens:
        qtokens = [t for t in normalize(q).split() if t]
    stores = await db.stores.find({}, {"_id": 0}).to_list(1000)
    results = []
    for store in stores:
        score, matched_products, all_match = score_store(store, qtokens)
        if score > 0 and (matched_products or all_match):
            store_copy = dict(store)
            store_copy["products"] = normalized_products(store)
            store_copy["matched_products"] = matched_products
            store_copy["_score"] = score
            results.append(store_copy)
    results.sort(key=lambda s: (not s.get("isPartner"), -s["_score"]))
    for r in results:
        r.pop("_score", None)
    return {"query": q, "results": results}


# ---------- Auth routes ----------
@api_router.post("/auth/login")
async def login(data: LoginInput):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou senha inválidos")
    token = create_access_token(str(user.get("_id")), email)
    return {"token": token, "email": email, "role": user.get("role", "admin")}


@api_router.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return current


# ---------- File upload / serve ----------
@api_router.post("/admin/upload")
async def upload_image(file: UploadFile = File(...), current=Depends(get_current_user)):
    filename = file.filename or "imagem"
    ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
    content_type = (file.content_type or "").lower()

    # Browsers/phones sometimes send a generic extension, so accept a known image MIME too.
    mime_to_ext = {v: k for k, v in MIME_TYPES.items()}
    if ext not in MIME_TYPES and content_type in mime_to_ext:
        ext = mime_to_ext[content_type]
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado. Use JPG, PNG, GIF ou WEBP")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="A imagem está vazia")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Imagem muito grande (máx 8MB)")

    file_id = str(uuid.uuid4())
    content_type = MIME_TYPES[ext]

    # Store directly in MongoDB. This removes the production dependency on the
    # Emergent object-storage token, which is commonly unavailable on Render.
    # The 8 MB limit is safely below MongoDB's 16 MB document limit.
    await db.files.insert_one({
        "id": file_id,
        "data": Binary(data),
        "original_filename": filename,
        "content_type": content_type,
        "size": len(data),
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"url": f"/api/files/{file_id}"}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    # New uploads are addressed by their Mongo file id.
    record = await db.files.find_one({"id": path, "is_deleted": False})
    if record and record.get("data") is not None:
        return Response(content=bytes(record["data"]), media_type=record.get("content_type", "application/octet-stream"))

    # Backwards compatibility for photos previously uploaded to Emergent storage.
    legacy = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not legacy:
        raise HTTPException(status_code=404, detail="Arquivo não encontrado")
    try:
        data, content_type = get_object(path)
    except Exception:
        logger.exception("Falha ao carregar arquivo legado %s", path)
        raise HTTPException(status_code=502, detail="Não foi possível carregar esta imagem antiga")
    return Response(content=data, media_type=legacy.get("content_type", content_type))


# ---------- Admin routes ----------
@api_router.post("/admin/stores")
async def create_store(data: StoreInput, current=Depends(get_current_user)):
    store = Store(**data.model_dump())
    await db.stores.insert_one(store.model_dump())
    return store.model_dump()


@api_router.put("/admin/stores/{store_id}")
async def update_store(store_id: str, data: StoreInput, current=Depends(get_current_user)):
    existing = await db.stores.find_one({"id": store_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    update = data.model_dump()
    update["id"] = store_id
    await db.stores.replace_one({"id": store_id}, update)
    result = await db.stores.find_one({"id": store_id}, {"_id": 0})
    return result


@api_router.delete("/admin/stores/{store_id}")
async def delete_store(store_id: str, current=Depends(get_current_user)):
    res = await db.stores.delete_one({"id": store_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
    return {"deleted": True}


app.include_router(api_router)

# ---------- CORS ----------
# Production frontend lives on Netlify. Keep it explicitly allowed so browser
# uploads (multipart/form-data + Authorization) can reach the Render API.
def _cors_origins():
    defaults = [
        "https://pesquisaaibj.netlify.app",
        "http://localhost:3000",
        "http://localhost:5173",
    ]
    configured = os.environ.get("CORS_ORIGINS", "")
    extra = [origin.strip().rstrip("/") for origin in configured.split(",") if origin.strip() and origin.strip() != "*"]
    return list(dict.fromkeys(defaults + extra))


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=86400,
)


# ---------- Seeding ----------
SEED_STORES = [
    {
        "name": "REKILDER MODAS",
        "category": "Moda e utilidades",
        "products": [
            "Cercadinho", "Moda adulta", "Naninhas", "Organizadores", "Caixas",
            "Baldes", "Bacias", "Escova de dente", "Banheiras para bebês",
            "Moda baby", "Moda infantil", "Pijamas", "Bolsas", "Sapatos",
            "Camisa UV", "Shorts de praia", "Cuecas", "Calcinhas", "Shorts",
            "Shorts Ogochi", "Camisas Ogochi", "Conjuntos",
        ],
    },
    {
        "name": "ATM MAGAZINE",
        "category": "Infantil e juvenil",
        "products": [
            "Pijamas", "Produtos de silicone", "Babadores", "Garrafinhas",
            "Bolsas escolares", "Estojos", "Lancheiras", "Garrafas", "Sandálias",
            "Sapatos", "Conjuntos para bebês", "Conjuntos infantis", "Blusas",
            "Shorts", "Triciclos", "Sapatos Bibi", "Produtos Lilica", "Bolsas Lilica",
            "Botas", "Camisas xadrez", "Bicicletas para bebês/crianças", "Vestidos",
            "Camisas regata", "Óculos", "Camisas sociais", "Casacos",
        ],
    },
    {
        "name": "GALLEGA MODAS",
        "category": "Moda feminina e masculina",
        "products": [
            "Moda praia", "Bolsas", "Vestidos", "Conjuntos", "Calças", "Blusas",
            "Camisas sociais masculinas", "Calça social masculina",
            "Camisa xadrez masculina", "Saias femininas", "Botas",
            "Camisas regata femininas", "Croppeds", "Shorts femininos",
            "Jaquetas masculinas", "Casacos",
        ],
    },
    {
        "name": "ESCANDAL",
        "category": "Moda feminina atemporal",
        "products": [
            "Conjuntos", "Shorts femininos", "Blusas femininas", "Looks para noite",
            "Looks para praia", "Looks para resort", "Looks para jantar", "Biquínis",
            "Maiôs", "Calça jeans", "Bodys", "Camisas listradas",
            "Camisas 100% algodão", "Blusa poá", "Jeans barrel", "Jeans wide leg",
            "Jeans reta", "Jaquetas jeans", "Jaquetas",
        ],
    },
]


@app.on_event("startup")
async def startup():
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")

    admin_email = os.environ["ADMIN_EMAIL"].lower().strip()
    admin_password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        await db.users.insert_one({
            "email": admin_email,
            "password_hash": hash_password(admin_password),
            "role": "admin",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password)}})

    count = await db.stores.count_documents({})
    if count == 0:
        for s in SEED_STORES:
            store = Store(
                name=s["name"],
                category=s.get("category", ""),
                products=[Product(name=n) for n in s["products"]],
            )
            await db.stores.insert_one(store.model_dump())
        logger.info("Stores seeded")


@app.on_event("shutdown")
async def shutdown():
    client.close()

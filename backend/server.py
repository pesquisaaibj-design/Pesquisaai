from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends
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
from datetime import datetime, timezone, timedelta

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

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


def score_store(store: dict, qtokens):
    haystack = " ".join([
        store.get("name", ""),
        store.get("description", ""),
        store.get("category", ""),
        " ".join(p.get("name", "") for p in store.get("products", [])),
    ])
    text_tokens = normalize(haystack).split()

    matched_products = []
    for p in store.get("products", []):
        p_tokens = normalize(p.get("name", "")).split()
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
    stores.sort(key=lambda s: (not s.get("isPartner"), s.get("name", "")))
    return stores


@api_router.get("/stores/{store_id}")
async def get_store(store_id: str):
    store = await db.stores.find_one({"id": store_id}, {"_id": 0})
    if not store:
        raise HTTPException(status_code=404, detail="Loja não encontrada")
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

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
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

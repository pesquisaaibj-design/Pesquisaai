"""Backend tests for PesquisaAí MVP."""
import os
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://busca-belo-jardim.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "lucas.lucenacs22@gmail.com"
ADMIN_PASSWORD = "Luc@s1103445"

EXPECTED_STORES = {"REKILDER MODAS", "ATM MAGAZINE", "GALLEGA MODAS", "ESCANDAL"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def token(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


# ---------- Public: stores ----------
class TestStores:
    def test_list_stores_returns_four_seeded(self, session):
        r = session.get(f"{API}/stores")
        assert r.status_code == 200
        stores = r.json()
        names = {s["name"] for s in stores}
        assert EXPECTED_STORES.issubset(names), f"Missing stores; got: {names}"
        for s in stores:
            if s["name"] in EXPECTED_STORES:
                assert isinstance(s.get("products"), list)
                assert len(s["products"]) > 0
                assert "_id" not in s

    def test_get_store_by_id(self, session):
        r = session.get(f"{API}/stores")
        store_id = r.json()[0]["id"]
        r2 = session.get(f"{API}/stores/{store_id}")
        assert r2.status_code == 200
        assert r2.json()["id"] == store_id

    def test_get_store_invalid_id_404(self, session):
        r = session.get(f"{API}/stores/nonexistent-id-xyz")
        assert r.status_code == 404


# ---------- Search ----------
class TestSearch:
    def test_search_short_praia(self, session):
        r = session.get(f"{API}/search", params={"q": "short praia"})
        assert r.status_code == 200
        data = r.json()
        rekilder = next((s for s in data["results"] if s["name"] == "REKILDER MODAS"), None)
        assert rekilder is not None, f"REKILDER MODAS not in results: {[s['name'] for s in data['results']]}"
        matched_names = [p["name"] for p in rekilder["matched_products"]]
        assert any("Shorts de praia" in m for m in matched_names), f"Shorts de praia not matched: {matched_names}"

    def test_search_roupa_de_bebe(self, session):
        r = session.get(f"{API}/search", params={"q": "roupa de bebe"})
        assert r.status_code == 200
        data = r.json()
        rekilder = next((s for s in data["results"] if s["name"] == "REKILDER MODAS"), None)
        assert rekilder is not None, f"REKILDER MODAS not in results: {[s['name'] for s in data['results']]}"
        matched_names = [p["name"] for p in rekilder["matched_products"]]
        assert any("Moda baby" in m for m in matched_names), f"Moda baby not matched: {matched_names}"

    def test_search_empty(self, session):
        r = session.get(f"{API}/search", params={"q": ""})
        assert r.status_code == 200
        assert r.json()["results"] == []


# ---------- Auth ----------
class TestAuth:
    def test_login_success(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["email"] == ADMIN_EMAIL

    def test_login_wrong_password(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrongpass"})
        assert r.status_code == 401

    def test_me_without_token(self, session):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_me_with_token(self, session, token):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL


# ---------- Admin CRUD ----------
class TestAdminCRUD:
    def test_create_requires_auth(self, session):
        r = requests.post(f"{API}/admin/stores", json={"name": "TEST_NoAuth"})
        assert r.status_code == 401

    def test_update_requires_auth(self, session):
        r = requests.put(f"{API}/admin/stores/some-id", json={"name": "x"})
        assert r.status_code == 401

    def test_delete_requires_auth(self, session):
        r = requests.delete(f"{API}/admin/stores/some-id")
        assert r.status_code == 401

    def test_full_crud_cycle(self, token):
        headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        # Create
        payload = {
            "name": "TEST_STORE_CRUD",
            "category": "Test",
            "products": [{"name": "TestProduct1"}, {"name": "TestProduct2"}],
        }
        r = requests.post(f"{API}/admin/stores", json=payload, headers=headers)
        assert r.status_code == 200, r.text
        created = r.json()
        sid = created["id"]
        assert created["name"] == "TEST_STORE_CRUD"
        assert created["isPartner"] is False

        # Verify persistence via GET
        r_get = requests.get(f"{API}/stores/{sid}")
        assert r_get.status_code == 200
        assert r_get.json()["name"] == "TEST_STORE_CRUD"

        # Update: change name, set partner, edit products
        update_payload = {
            "name": "TEST_STORE_UPDATED",
            "category": "TestCat2",
            "isPartner": True,
            "products": [{"name": "NewProduct"}],
        }
        r = requests.put(f"{API}/admin/stores/{sid}", json=update_payload, headers=headers)
        assert r.status_code == 200
        upd = r.json()
        assert upd["name"] == "TEST_STORE_UPDATED"
        assert upd["isPartner"] is True
        assert len(upd["products"]) == 1
        assert upd["products"][0]["name"] == "NewProduct"

        # Verify update persisted
        r_get = requests.get(f"{API}/stores/{sid}")
        assert r_get.json()["isPartner"] is True

        # Delete
        r = requests.delete(f"{API}/admin/stores/{sid}", headers=headers)
        assert r.status_code == 200
        assert r.json().get("deleted") is True

        # Verify deletion
        r_get = requests.get(f"{API}/stores/{sid}")
        assert r_get.status_code == 404

    def test_seeded_stores_still_intact(self, session):
        """After CRUD test, still 4 seeded stores."""
        r = session.get(f"{API}/stores")
        names = {s["name"] for s in r.json()}
        assert EXPECTED_STORES.issubset(names)

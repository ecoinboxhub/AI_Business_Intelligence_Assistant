from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_kpis():
    response = client.get("/api/kpis")
    assert response.status_code == 200
    data = response.json()
    assert "total_revenue" in data
    assert "profit_margin_pct" in data


def test_question():
    response = client.post(
        "/api/questions", json={"question": "Which region has the highest revenue?"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "findings" in data

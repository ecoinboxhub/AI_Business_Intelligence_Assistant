import pytest
from fastapi.testclient import TestClient

from app.main import INTENT_REGISTRY, app, resolve_intent

client = TestClient(app)


def test_catalog():
    response = client.get("/api/catalog")
    assert response.status_code == 200
    catalog = response.json()
    assert len(catalog) >= 9
    assert all({"id", "label"} <= set(item) for item in catalog)


@pytest.mark.parametrize("entry", INTENT_REGISTRY, ids=lambda e: e["id"])
def test_every_intent_returns_full_structured_answer(entry):
    response = client.post("/api/questions", json={"question": entry["label"]})
    assert response.status_code == 200
    data = response.json()
    assert data["answer"].strip()
    assert data["findings"], "findings must be non-empty"
    assert data["recommendations"], "recommendations must be non-empty"
    assert data["chart"] is not None, "chart payload required"
    assert data["chart"]["data"], "chart.data must contain computed rows"
    assert data["follow_up_questions"]


def test_unknown_intent_lists_suggestions():
    response = client.post("/api/questions", json={"question": "zzz gibberish qqq"})
    assert response.status_code == 200
    data = response.json()
    assert data["confidence"] == "medium"
    assert data["follow_up_questions"]
    assert data["chart"] is None


def test_analysis_endpoint():
    response = client.get("/api/analysis/campaign_roi")
    assert response.status_code == 200
    data = response.json()
    assert data["label"]
    assert data["chart"]["type"] == "horizontal_bar"

    missing = client.get("/api/analysis/does_not_exist")
    assert missing.status_code == 404


def test_every_catalog_label_resolves_to_its_own_intent():
    for entry in INTENT_REGISTRY:
        hit = resolve_intent(entry["label"])
        assert hit is not None
        assert hit["id"] == entry["id"], (
            f"Question '{entry['label']}' routed to '{hit['id']}' instead of its own intent"
        )


def test_employee_question_routes_to_employee_performance():
    q = "Which employees perform well based on both revenue and profitability?"
    assert resolve_intent(q)["id"] == "employee_performance"


def test_question_response_includes_flat_chart_fields():
    response = client.post(
        "/api/questions",
        json={"question": "Which marketing campaigns generate the best return on investment?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "campaign_roi"
    assert data["chart_type"] == "horizontal_bar"
    assert data["chart_title"]
    assert isinstance(data["chart_data"], list) and data["chart_data"]
    # nested payload stays in sync with the flat fields
    assert data["chart"]["type"] == data["chart_type"]
    assert data["chart"]["data"] == data["chart_data"]


def test_insights_are_computed_from_dataset_not_static():
    response = client.get("/api/insights")
    assert response.status_code == 200
    data = response.json()
    assert len(data["findings"]) >= 3
    assert len(data["recommendations"]) >= 2
    # computed insights quote dataset numbers (₦ amounts or percentages)
    assert any(("₦" in f) or ("%" in f) for f in data["findings"])

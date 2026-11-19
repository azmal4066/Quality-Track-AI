from app.api.reports import csv_bytes


def test_csv_has_header_and_rows():
    items = [{"id": "a", "status": "PASS", "quality_score": 100, "defect_count": 0, "batch_number": "B1",
              "created_at": "2026-01-01", "products": {"product_code": "P1"}}]
    out = csv_bytes(items).decode().splitlines()
    assert out[0].startswith("inspection_id,product_code")
    assert "P1,B1,PASS" in out[1]

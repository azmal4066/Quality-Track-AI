from app.api import reports


def test_month_boundary_december_rolls_year(monkeypatch):
    captured = {}

    class Q:
        def select(self, *_): return self
        def order(self, *_): return self
        def eq(self, *_): return self
        def gte(self, col, v): captured["gte"] = v; return self
        def lt(self, col, v): captured["lt"] = v; return self
        def execute(self): return type("R", (), {"data": []})()

    class SB:
        def table(self, _): return Q()

    monkeypatch.setattr(reports, "get_supabase", lambda: SB())
    reports._list(month="2026-12")
    assert captured == {"gte": "2026-12-01", "lt": "2027-01-01"}

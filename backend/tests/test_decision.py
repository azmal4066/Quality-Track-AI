from app.services.decision import decide, quality_score, severity_from_confidence


def test_no_detections_pass():
    assert decide([], 0.3, 0.6) == "PASS"


def test_high_conf_fail():
    assert decide([0.9, 0.2], 0.3, 0.6) == "FAIL"


def test_mid_conf_review():
    assert decide([0.45], 0.3, 0.6) == "REVIEW"


def test_low_conf_pass():
    assert decide([0.2], 0.3, 0.6) == "PASS"


def test_quality_score_bounds():
    assert quality_score([]) == 100
    assert quality_score([0.9] * 5) == 0


def test_severity():
    assert severity_from_confidence(0.9) == "critical"
    assert severity_from_confidence(0.1) == "low"

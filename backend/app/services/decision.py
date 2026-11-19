"""Configurable PASS / FAIL / REVIEW logic.
- model confidence  = how sure the detector is about each box
- quality score     = a derived 0-100 product score (NOT the same thing)"""
SEVERITY_WEIGHT = {"low": 5, "medium": 12, "high": 25, "critical": 45}


def severity_from_confidence(conf: float) -> str:
    if conf >= 0.85: return "critical"
    if conf >= 0.70: return "high"
    if conf >= 0.50: return "medium"
    return "low"


def decide(confidences: list[float], pass_max: float, fail_min: float) -> str:
    if not confidences:
        return "PASS"
    top = max(confidences)
    if top >= fail_min:
        return "FAIL"
    if top <= pass_max:
        return "PASS"
    return "REVIEW"


def quality_score(confidences: list[float]) -> float:
    penalty = sum(SEVERITY_WEIGHT[severity_from_confidence(c)] for c in confidences)
    return float(max(0, 100 - penalty))

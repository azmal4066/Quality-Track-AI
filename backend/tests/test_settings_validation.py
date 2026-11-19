import pytest
from fastapi import HTTPException
from app.api import settings as st


class U:
    id = "u"


def test_unknown_key_rejected():
    with pytest.raises(HTTPException) as e:
        st.put_setting("nope", st.SettingBody(value=1), U())
    assert e.value.status_code == 404


def test_bad_thresholds_rejected():
    with pytest.raises(HTTPException) as e:
        st.put_setting("thresholds", st.SettingBody(value={"pass_max_confidence": 0.9, "fail_min_confidence": 0.2}), U())
    assert e.value.status_code == 422

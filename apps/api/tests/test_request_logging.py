import json
import logging

from app.core.middleware import REQUEST_ID_HEADER


def test_response_includes_a_generated_request_id(client):
    response = client.get("/api/v1/app/features")

    assert response.status_code == 200
    assert response.headers.get(REQUEST_ID_HEADER)


def test_response_echoes_a_caller_supplied_request_id(client):
    response = client.get(
        "/api/v1/app/features", headers={REQUEST_ID_HEADER: "caller-supplied-id"}
    )

    assert response.headers.get(REQUEST_ID_HEADER) == "caller-supplied-id"


def test_each_request_gets_a_distinct_request_id_when_unset(client):
    first = client.get("/api/v1/app/features").headers.get(REQUEST_ID_HEADER)
    second = client.get("/api/v1/app/features").headers.get(REQUEST_ID_HEADER)

    assert first != second


def test_request_is_logged_with_its_request_id(client, caplog):
    with caplog.at_level(logging.INFO, logger="atlas.request"):
        response = client.get(
            "/api/v1/app/features", headers={REQUEST_ID_HEADER: "log-check-id"}
        )

    request_id = response.headers.get(REQUEST_ID_HEADER)
    matching = [record for record in caplog.records if getattr(record, "request_id", None) == request_id]
    assert matching, "expected a log record tagged with the response's request_id"
    assert "GET" in matching[0].getMessage()
    assert "/api/v1/app/features" in matching[0].getMessage()


def test_json_formatter_produces_valid_json_with_expected_fields():
    from app.core.logging import _JsonFormatter, set_request_id

    set_request_id("format-test-id")
    record = logging.LogRecord(
        name="atlas.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="hello %s",
        args=("world",),
        exc_info=None,
    )
    formatter = _JsonFormatter()
    # The formatter reads request_id off the record itself (set by the logging filter in real
    # use); simulate that here rather than relying on the filter being attached.
    record.request_id = "format-test-id"

    parsed = json.loads(formatter.format(record))

    assert parsed["message"] == "hello world"
    assert parsed["level"] == "INFO"
    assert parsed["request_id"] == "format-test-id"
    assert parsed["logger"] == "atlas.test"
    set_request_id(None)

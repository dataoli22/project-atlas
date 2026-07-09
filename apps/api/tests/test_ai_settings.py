def test_read_ai_settings_exposes_cloud_first_with_local_fallback_defaults(client):
    response = client.get("/api/v1/settings/ai")

    assert response.status_code == 200
    payload = response.json()

    assert payload["default_provider"] == "ollama"
    assert payload["local_only_mode"] is False
    assert payload["allow_groq"] is False
    assert "stay on this device" in payload["device_notice"]
    assert "on-device Ollama" in payload["device_notice"]
    assert {profile["module"] for profile in payload["prompt_profiles"]} == {
        "shared",
        "endurance",
        "nutrition",
    }
    assert all(
        profile["max_context_tokens"] == payload["max_context_tokens"]
        and profile["response_token_budget"] == payload["response_token_budget"]
        for profile in payload["prompt_profiles"]
    )


def test_update_ai_settings_rejects_non_ollama_provider_in_local_only_mode(client):
    response = client.put(
        "/api/v1/settings/ai",
        json={
            "default_provider": "groq",
            "local_only_mode": True,
            "self_hosted_distribution": True,
            "allow_groq": False,
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.1:8b",
            "ollama_embed_model": "nomic-embed-text",
            "groq_model": "llama-3.1-8b-instant",
            "system_prompt_style": "token-lean",
            "guardrail_level": "strict",
            "max_context_items": 6,
            "max_context_tokens": 2400,
            "response_token_budget": 450,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Local-only mode requires Ollama as the default provider."


def test_update_ai_settings_rejects_groq_enablement_in_local_only_mode(client):
    response = client.put(
        "/api/v1/settings/ai",
        json={
            "default_provider": "ollama",
            "local_only_mode": True,
            "self_hosted_distribution": True,
            "allow_groq": True,
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.1:8b",
            "ollama_embed_model": "nomic-embed-text",
            "groq_model": "llama-3.1-8b-instant",
            "system_prompt_style": "token-lean",
            "guardrail_level": "strict",
            "max_context_items": 6,
            "max_context_tokens": 2400,
            "response_token_budget": 450,
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Groq cannot be enabled while local-only mode is active."


def test_update_ai_settings_allows_remote_provider_only_when_local_only_is_disabled(client):
    response = client.put(
        "/api/v1/settings/ai",
        json={
            "default_provider": "groq",
            "local_only_mode": False,
            "self_hosted_distribution": True,
            "allow_groq": True,
            "ollama_base_url": "http://localhost:11434",
            "ollama_model": "llama3.1:8b",
            "ollama_embed_model": "nomic-embed-text",
            "ollama_api_key": "  local-secret  ",
            "groq_model": "llama-3.3-70b-versatile",
            "groq_api_key": "  groq-secret  ",
            "system_prompt_style": "comprehensive-guarded",
            "guardrail_level": "maximum",
            "max_context_items": 8,
            "max_context_tokens": 3200,
            "response_token_budget": 700,
        },
    )

    assert response.status_code == 200
    payload = response.json()

    assert payload["default_provider"] == "groq"
    assert payload["local_only_mode"] is False
    assert payload["allow_groq"] is True
    assert payload["groq_model"] == "llama-3.3-70b-versatile"
    assert payload["ollama_api_key_set"] is True
    assert payload["groq_api_key_set"] is True
    assert payload["guardrail_level"] == "maximum"
    assert payload["system_prompt_style"] == "comprehensive-guarded"

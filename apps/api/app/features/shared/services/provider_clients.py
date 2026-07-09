from __future__ import annotations

import json
from dataclasses import dataclass
from urllib import request


@dataclass
class ProviderResult:
    provider: str
    model: str
    answer: str


@dataclass
class StravaTokenExchangeResult:
    access_token: str
    refresh_token: str
    expires_at: int | None
    athlete_id: str | None


@dataclass
class StravaAthleteProfile:
    athlete_id: str
    username: str | None
    firstname: str | None
    lastname: str | None


@dataclass
class StravaActivity:
    activity_id: str
    name: str
    sport_type: str
    moving_time_seconds: int
    distance_meters: float
    start_date: str


class ProviderClient:
    def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int) -> ProviderResult:
        raise NotImplementedError


class OllamaProviderClient(ProviderClient):
    def __init__(self, *, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int) -> ProviderResult:
        payload = json.dumps(
            {
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {"num_predict": response_token_budget},
            }
        ).encode("utf-8")

        headers = {"Content-Type": "application/json"}
        if self._api_key:
            headers["Authorization"] = f"Bearer {self._api_key}"

        req = request.Request(
            f"{self._base_url}/api/chat",
            data=payload,
            headers=headers,
            method="POST",
        )
        # Ollama generation is local, CPU/GPU-bound compute, not a fast hosted API call - a
        # cold model load or a larger model on modest hardware can easily exceed 20s even for a
        # short response (observed ~25s for a 3-word reply from a 7B model on a CPU-bound
        # device). 120s balances staying responsive against not false-classifying a merely slow
        # local device as "timeout".
        with request.urlopen(req, timeout=120) as response:
            body = json.loads(response.read().decode("utf-8"))
            answer = body.get("message", {}).get("content", "").strip()
            return ProviderResult(provider="ollama", model=model, answer=answer)


class GroqProviderClient(ProviderClient):
    def __init__(self, *, api_key: str, base_url: str = "https://api.groq.com/openai/v1") -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    def complete(self, *, model: str, messages: list[dict[str, str]], response_token_budget: int) -> ProviderResult:
        payload = json.dumps(
            {
                "model": model,
                "messages": messages,
                "max_tokens": response_token_budget,
            }
        ).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self._api_key}",
        }
        req = request.Request(
            f"{self._base_url}/chat/completions",
            data=payload,
            headers=headers,
            method="POST",
        )
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
            answer = (
                body.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            return ProviderResult(provider="groq", model=model, answer=answer)


class StravaOAuthClient:
    def __init__(self, *, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret

    def exchange_code_for_tokens(self, *, code: str) -> StravaTokenExchangeResult:
        return self._exchange_token_payload(
            {
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "code": code,
                "grant_type": "authorization_code",
            }
        )

    def refresh_access_token(self, *, refresh_token: str) -> StravaTokenExchangeResult:
        return self._exchange_token_payload(
            {
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            }
        )

    def _exchange_token_payload(self, payload_dict: dict[str, str]) -> StravaTokenExchangeResult:
        payload = json.dumps(
            payload_dict
        ).encode("utf-8")

        req = request.Request(
            "https://www.strava.com/oauth/token",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
            athlete = body.get("athlete", {})
            athlete_id = athlete.get("id")
            return StravaTokenExchangeResult(
                access_token=body.get("access_token", ""),
                refresh_token=body.get("refresh_token", ""),
                expires_at=body.get("expires_at"),
                athlete_id=str(athlete_id) if athlete_id is not None else None,
            )

    def get_athlete_profile(self, *, access_token: str) -> StravaAthleteProfile:
        req = request.Request(
            "https://www.strava.com/api/v3/athlete",
            headers={"Authorization": f"Bearer {access_token}"},
            method="GET",
        )
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
            athlete_id = body.get("id")
            return StravaAthleteProfile(
                athlete_id=str(athlete_id) if athlete_id is not None else "",
                username=body.get("username"),
                firstname=body.get("firstname"),
                lastname=body.get("lastname"),
            )

    def list_recent_activities(
        self,
        *,
        access_token: str,
        per_page: int = 5,
    ) -> list[StravaActivity]:
        req = request.Request(
            f"https://www.strava.com/api/v3/athlete/activities?per_page={per_page}",
            headers={"Authorization": f"Bearer {access_token}"},
            method="GET",
        )
        with request.urlopen(req, timeout=20) as response:
            body = json.loads(response.read().decode("utf-8"))
            return [
                StravaActivity(
                    activity_id=str(item.get("id", "")),
                    name=item.get("name", "Untitled activity"),
                    sport_type=item.get("sport_type", item.get("type", "Workout")),
                    moving_time_seconds=int(item.get("moving_time", 0)),
                    distance_meters=float(item.get("distance", 0.0)),
                    start_date=item.get("start_date", ""),
                )
                for item in body
            ]

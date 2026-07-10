def test_pantry_starts_empty(client):
    response = client.get("/api/v1/nutrition/pantry")

    assert response.status_code == 200
    assert response.json() == {"items": []}


def test_adding_a_pantry_item_persists_it(client):
    add_response = client.post("/api/v1/nutrition/pantry", json={"name": "Onions"})

    assert add_response.status_code == 200
    assert add_response.json() == {"items": ["Onions"]}

    read_response = client.get("/api/v1/nutrition/pantry")
    assert read_response.json() == {"items": ["Onions"]}


def test_adding_the_same_item_twice_does_not_duplicate_it(client):
    client.post("/api/v1/nutrition/pantry", json={"name": "Rice"})
    response = client.post("/api/v1/nutrition/pantry", json={"name": "rice"})

    assert response.json() == {"items": ["Rice"]}


def test_adding_a_blank_pantry_item_is_rejected(client):
    response = client.post("/api/v1/nutrition/pantry", json={"name": "   "})

    assert response.status_code == 400


def test_removing_a_pantry_item(client):
    client.post("/api/v1/nutrition/pantry", json={"name": "Garlic"})

    response = client.delete("/api/v1/nutrition/pantry/Garlic")

    assert response.status_code == 200
    assert response.json() == {"items": []}


def test_removing_a_pantry_item_is_case_insensitive(client):
    client.post("/api/v1/nutrition/pantry", json={"name": "Garlic"})

    response = client.delete("/api/v1/nutrition/pantry/GARLIC")

    assert response.json() == {"items": []}


def test_shopping_list_flags_items_already_in_the_pantry(client):
    baseline = client.get("/api/v1/nutrition/shopping-list").json()
    assert baseline["items"], "expected the blueprint to have at least one shopping item"
    target_item = baseline["items"][0]

    client.post("/api/v1/nutrition/pantry", json={"name": target_item["name"]})

    response = client.get("/api/v1/nutrition/shopping-list")
    payload = response.json()

    matched = next(item for item in payload["items"] if item["name"] == target_item["name"])
    assert matched["already_in_pantry"] is True
    assert payload["pantry_matched_count"] == 1
    # The matched item is still visible in the list (flagged, not hidden) ...
    assert any(item["name"] == target_item["name"] for item in payload["items"])
    # ... but "still need to buy" totals exclude it.
    assert payload["total_items"] == len(baseline["items"]) - 1


def test_shopping_list_pantry_match_is_a_substring_match_not_exact(client):
    baseline = client.get("/api/v1/nutrition/shopping-list").json()
    target_item = baseline["items"][0]
    # A pantry entry that's a substring of the item name (or vice versa) should still match -
    # real pantry entries are rarely worded identically to blueprint ingredient names.
    partial_name = target_item["name"].split(" ")[0]

    client.post("/api/v1/nutrition/pantry", json={"name": partial_name})

    response = client.get("/api/v1/nutrition/shopping-list")
    matched = next(item for item in response.json()["items"] if item["name"] == target_item["name"])
    assert matched["already_in_pantry"] is True


def test_shopping_list_with_no_pantry_items_matches_nothing(client):
    response = client.get("/api/v1/nutrition/shopping-list")
    payload = response.json()

    assert payload["pantry_matched_count"] == 0
    assert all(item["already_in_pantry"] is False for item in payload["items"])

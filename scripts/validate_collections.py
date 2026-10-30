"""Validate catalogue records before either collection is deployed."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
for name in ("watches.json", "watches-limited.json"):
    watches = json.loads((ROOT / name).read_text())
    assert isinstance(watches, list) and watches, f"{name}: expected nonempty array"
    ids, models = set(), set()
    for watch in watches:
        for field in ("id", "brand", "collection", "model", "style", "description", "source", "specs", "pros", "cons"):
            assert watch.get(field), f"{name}: missing {field}"
        assert watch["id"] not in ids, f"{name}: duplicate id"
        assert watch["model"] not in models, f"{name}: duplicate model"
        ids.add(watch["id"])
        models.add(watch["model"])
        if name == "watches-limited.json":
            edition = watch["limitedEdition"]
            assert isinstance(edition["quantity"], int) and edition["quantity"] > 0
            assert edition["source"].startswith("https://")
            assert watch["image"].startswith("https://")
            assert watch["availability"]["label"]
    print(f"{name}: {len(watches)} valid records")

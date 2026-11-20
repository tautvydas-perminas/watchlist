import base64
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
FILES = {"original": "watches.json", "limited": "watches-limited.json"}
REPO = "tautvydas-perminas/watchlist"
EDITOR_ASSETS = Path(__file__).with_name("editor_assets")
EDITOR_TYPES = {
    "index.html": "text/html",
    "styles.css": "text/css",
    "app.js": "application/javascript",
    "editor.js": "application/javascript",
    "editor-config.js": "application/javascript",
}



def respond(data, status=200):
    return func.HttpResponse(json.dumps(data, ensure_ascii=False), status_code=status,
                             mimetype="application/json")


def github(method, path, payload=None):
    token = os.environ["GITHUB_TOKEN"]
    request = urllib.request.Request(
        "https://api.github.com/repos/" + REPO + "/contents/" + path,
        data=json.dumps(payload).encode() if payload else None,
        method=method,
        headers={"Authorization": "Bearer " + token,
                 "Accept": "application/vnd.github+json",
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "watchlist-editor",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.load(response)


def can_edit(req):
    # App Service Authentication must validate the session and inject this header.
    principal = req.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    allowed = os.getenv("ALLOWED_PRINCIPAL_ID", "")
    return bool(allowed and principal and principal.lower() == allowed.lower())


@app.route(route="watchlist/{collection}", methods=["GET", "PUT"])
def watchlist(req: func.HttpRequest) -> func.HttpResponse:
    if not can_edit(req):
        return respond({"error": "Forbidden"}, 403)
    collection = req.route_params.get("collection")
    if collection not in FILES:
        return respond({"error": "Unknown collection"}, 404)
    try:
        current = github("GET", FILES[collection])
        original = json.loads(base64.b64decode(current["content"]))
        if req.method == "GET":
            return respond({"items": original, "sha": current["sha"]})
        body = req.get_json()
        ids = body.get("ids")
        if not isinstance(ids, list) or not all(isinstance(x, (str, int)) for x in ids):
            return respond({"error": "Invalid IDs"}, 400)
        if len(ids) != len(set(map(str, ids))):
            return respond({"error": "Duplicate IDs"}, 400)
        existing = {str(item["id"]): item for item in original}
        if len(existing) != len(original) or not set(map(str, ids)).issubset(existing):
            return respond({"error": "Invalid or stale IDs"}, 409)
        if not ids:
            return respond({"error": "Cannot empty collection"}, 400)
        if body.get("sha") != current["sha"]:
            return respond({"error": "Collection changed. Reload before saving."}, 409)
        # Only reorder, remove and update user-authored comments.
        comments = body.get("comments", {})
        if not isinstance(comments, dict) or not set(comments).issubset(existing):
            return respond({"error": "Invalid comment IDs"}, 400)
        if not all(isinstance(value, str) and len(value) <= 3000 for value in comments.values()):
            return respond({"error": "Comments must be text up to 3000 characters"}, 400)
        updated = []
        for item_id in ids:
            item = existing[str(item_id)].copy()
            if str(item_id) in comments:
                item["comment"] = comments[str(item_id)]
            updated.append(item)
        encoded = base64.b64encode((json.dumps(updated, ensure_ascii=False, indent=2) + "\n").encode()).decode()
        result = github("PUT", FILES[collection], {
            "message": "Edit " + collection + " watchlist via website",
            "content": encoded, "sha": current["sha"], "branch": "main"})
        return respond({"ok": True, "commit": result["commit"]["sha"], "sha": result["content"]["sha"]})
    except (ValueError, KeyError, TypeError):
        return respond({"error": "Invalid request or GitHub response"}, 400)
    except urllib.error.HTTPError as error:
        return respond({"error": "GitHub request failed", "status": error.code}, 502)
    except Exception:
        return respond({"error": "Server error"}, 500)


@app.route(route="auth-return", methods=["GET"])
def auth_return(req: func.HttpRequest) -> func.HttpResponse:
    if not can_edit(req):
        return respond({"error": "Forbidden"}, 403)
    collection = req.params.get("list", "original")
    if collection not in FILES:
        collection = "original"
    destination = "/api/editor/index.html?list=" + collection
    return func.HttpResponse("", status_code=302, headers={"Location": destination, "Cache-Control": "no-store"})


@app.route(route="editor/{asset}", methods=["GET"])
def editor(req: func.HttpRequest) -> func.HttpResponse:
    if not can_edit(req):
        return respond({"error": "Forbidden"}, 403)

    asset = req.route_params.get("asset")
    headers = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
    if asset in EDITOR_TYPES:
        try:
            content = (EDITOR_ASSETS / asset).read_bytes()
        except OSError:
            return respond({"error": "Editor asset unavailable"}, 503)
        return func.HttpResponse(content, mimetype=EDITOR_TYPES[asset], headers=headers)

    if asset in FILES.values():
        try:
            content = base64.b64decode(github("GET", asset)["content"])
        except (OSError, ValueError, KeyError, TypeError):
            return respond({"error": "Could not load collection"}, 502)
        return func.HttpResponse(content, mimetype="application/json", headers=headers)

    return respond({"error": "Unknown editor asset"}, 404)

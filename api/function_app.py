import base64
import json
import os
import urllib.error
import urllib.request

import azure.functions as func

app = func.FunctionApp(http_auth_level=func.AuthLevel.ANONYMOUS)
FILES = {"original": "watches.json", "limited": "watches-limited.json"}
REPO = "tautvydas-perminas/watchlist"


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


@app.route(route="watchlist/{collection}", methods=["GET", "PUT"])
def watchlist(req: func.HttpRequest) -> func.HttpResponse:
    # CRITICAL: configure App Service Authentication to REQUIRE authentication
    # before deployment. This check is defense in depth, not a substitute.
    principal = req.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    allowed = os.getenv("ALLOWED_PRINCIPAL_ID", "")
    if not allowed or not principal or principal.lower() != allowed.lower():
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
        # Only reorder or remove; all watch attributes remain server-authoritative.
        updated = [existing[str(item_id)] for item_id in ids]
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
    # Redirect only to our fixed website origin, never to a user-supplied URL.
    principal = req.headers.get("X-MS-CLIENT-PRINCIPAL-ID")
    allowed = os.getenv("ALLOWED_PRINCIPAL_ID", "")
    if not allowed or not principal or principal.lower() != allowed.lower():
        return respond({"error": "Forbidden"}, 403)
    collection = req.params.get("list", "original")
    if collection not in FILES:
        collection = "original"
    destination = "https://portfoliomanager.z6.web.core.windows.net/?list=" + collection
    return func.HttpResponse("", status_code=302, headers={"Location": destination, "Cache-Control": "no-store"})

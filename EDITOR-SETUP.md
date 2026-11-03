# Watchlist editor deployment

The website editor and Python Azure Functions API live in this branch. **The API must never be exposed without Azure App Service Authentication.** Python's anonymous function route is deliberately protected by App Service Authentication plus an additional principal-ID check.

1. Create a new Linux Python 3.11 Function App named `func-watchlist-editor` (or another available globally unique name). Use a supported hosting plan, storage account, and Application Insights.
2. Configure **Authentication** > Add identity provider > Microsoft > Microsoft Entra ID. Set **Require authentication** and **HTTP 401 Unauthorized** for unauthenticated API requests. Restrict tenant access. Configure allowed audiences and identity provider correctly.
3. Set application settings `GITHUB_TOKEN` (fine-grained GitHub token, Contents: Read and write on ONLY tautvydas-perminas/watchlist), and `ALLOWED_PRINCIPAL_ID` (the exact X-MS-CLIENT-PRINCIPAL-ID assigned by Easy Auth to your account). Never commit secrets.
4. Deploy `api/` to the Function App using Azure Functions Core Tools or a separate deployment workflow with Azure OIDC credentials. Do not deploy the API to the static website.
5. In `editor-config.js`, set `window.WATCHLIST_EDITOR_API` to the Function App origin (https://...azurewebsites.net). Add the **exact static website origin** to Function App CORS and enable credentials. Never use wildcard origins with credentials.
6. Test sign-in, GET and PUT from the published site. Cross-site authentication cookies may be blocked by modern browsers; if so, use MSAL access tokens with Entra JWT validation at the API instead of cookie authentication. Do not disable authentication as a workaround.
7. Merge the feature branch after testing. Existing main-branch deployment uploads only index.html, app.js, styles.css and the two JSON files; **update the workflow to include editor.js and editor-config.js** before merging. Verify deploy succeeds.

Concurrency: PUT checks the source GitHub blob SHA. Reorder/delete updates only IDs, preserving all other fields. Concurrent changes are rejected rather than overwritten.

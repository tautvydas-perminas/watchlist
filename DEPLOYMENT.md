# Azure Storage deployment

The workflow in .github/workflows/deploy-storage.yml deploys index.html, app.js, styles.css, watches.json and watches-limited.json to the Azure Storage $web container on every push to main. It also supports manual runs from GitHub Actions. Both lists are validated before upload. The existing connection-string secret is reused.

The default page shows the original collection. The Limited Editions navigation link opens `?list=limited`, loading the independent `watches-limited.json` file. Both collections use the same card layout, search and filters; numbering follows each JSON array's order. Limited cards show the published worldwide production quantity and source, checked availability notes, and a price only when a numeric EUR source was found. Historical prices are labelled explicitly; no listed price implies confirmed stock or delivery to Lithuania.

## One-time setup

1. In the target Azure Storage account, enable Static website and set the index document name to index.html. This creates the $web container.
2. In Azure Portal, open the storage account's Access keys and copy its connection string.
3. In this repository, open Settings > Secrets and variables > Actions > New repository secret.
4. Name the secret AZURE_STORAGE_CONNECTION_STRING and paste the connection string as its value. Do not commit the connection string or put it in an issue.
5. Open Actions > Deploy website to Azure Storage > Run workflow, or push another commit to main.

The connection string selects the target storage account; no account name needs to be hardcoded in the workflow. Shared Key access must be enabled, and the storage network rules must allow the GitHub runner to connect.

Existing website files are overwritten. Other blobs are not deleted. README.md, this guide and workflow files are not uploaded. Images continue to load from the external URLs in watches.json.

The workflow checks JSON syntax before uploading. Blobs use no-cache so browsers revalidate after deployment. Uploads are serialized to avoid overlapping deployments.

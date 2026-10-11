#!/usr/bin/env bash
set -euo pipefail

RG="${RG:-neuroneus-rg}"
LOCATION="${LOCATION:-westeurope}"
STORAGE="${STORAGE:-neuroneusart}"
ENV_NAME="${ENV_NAME:-neuroneus-env}"
BROWSER="${BROWSER:-neuroneus-browser}"
PLAYWRIGHT="${PLAYWRIGHT:-1.64.0}"
ENV_FILE="${ENV_FILE:-.env.local}"

set_env() {
  python3 - "$ENV_FILE" "$1" "$2" <<'PY'
import re, sys
path, key, value = sys.argv[1:]
text = open(path).read() if __import__("os").path.exists(path) else ""
line = f'{key}="{value}"'
text = re.sub(rf"^{key}=.*$", line, text, flags=re.M) if re.search(rf"^{key}=", text, re.M) else text.rstrip("\n") + f"\n{line}\n"
open(path, "w").write(text)
PY
  echo "set $1 in $ENV_FILE"
}

az provider register -n Microsoft.App -o none
az provider register -n Microsoft.Storage -o none

if ! az storage account show -g "$RG" -n "$STORAGE" -o none 2>/dev/null; then
  az storage account create -g "$RG" -n "$STORAGE" -l "$LOCATION" --sku Standard_LRS --kind StorageV2 \
    --allow-blob-public-access true --min-tls-version TLS1_2 --https-only true -o none
fi
KEY=$(az storage account keys list -g "$RG" -n "$STORAGE" --query "[0].value" -o tsv)
for container in library art evidence; do
  az storage container create --account-name "$STORAGE" --account-key "$KEY" -n "$container" --public-access blob -o none
done
az storage account management-policy create -g "$RG" --account-name "$STORAGE" -o none --policy '{"rules":[{"enabled":true,"name":"expire-evidence","type":"Lifecycle","definition":{"actions":{"baseBlob":{"delete":{"daysAfterModificationGreaterThan":120}}},"filters":{"blobTypes":["blockBlob"],"prefixMatch":["evidence/"]}}}]}'
SAS=$(az storage account generate-sas --account-name "$STORAGE" --account-key "$KEY" --services b --resource-types co \
  --permissions racwl --expiry "$(date -u -v+2y +%Y-%m-%dT00:00Z 2>/dev/null || date -u -d '+2 years' +%Y-%m-%dT00:00Z)" --https-only -o tsv)
set_env AZURE_STORAGE_ACCOUNT "$STORAGE"
set_env AZURE_STORAGE_SAS "$SAS"

if ! az containerapp env show -g "$RG" -n "$ENV_NAME" -o none 2>/dev/null; then
  az containerapp env create -g "$RG" -n "$ENV_NAME" -l "$LOCATION" --logs-destination none -o none
fi

TOKEN=$(openssl rand -hex 24)
ENV_ID=$(az containerapp env show -g "$RG" -n "$ENV_NAME" --query id -o tsv)
SPEC=$(mktemp)
trap 'rm -f "$SPEC"' EXIT
cat > "$SPEC" <<YAML
location: $LOCATION
properties:
  managedEnvironmentId: $ENV_ID
  configuration:
    activeRevisionsMode: Single
    secrets:
      - name: wspath
        value: $TOKEN
    ingress:
      external: true
      targetPort: 3000
      transport: auto
  template:
    containers:
      - name: browser
        image: mcr.microsoft.com/playwright:v$PLAYWRIGHT-noble
        command: ["/bin/sh", "-c"]
        args: ["npx -y playwright@$PLAYWRIGHT run-server --port 3000 --host 0.0.0.0 --path /\$WS_PATH"]
        env:
          - name: WS_PATH
            secretRef: wspath
        resources:
          cpu: 2
          memory: 4Gi
    scale:
      minReplicas: 0
      maxReplicas: 2
YAML
if az containerapp show -g "$RG" -n "$BROWSER" -o none 2>/dev/null; then
  az containerapp update -g "$RG" -n "$BROWSER" --yaml "$SPEC" -o none
else
  az containerapp create -g "$RG" -n "$BROWSER" --yaml "$SPEC" -o none
fi
FQDN=$(az containerapp show -g "$RG" -n "$BROWSER" --query properties.configuration.ingress.fqdn -o tsv)
set_env BROWSER_WS_ENDPOINT "wss://$FQDN/$TOKEN"

echo "Done. Copy AZURE_STORAGE_ACCOUNT, AZURE_STORAGE_SAS and BROWSER_WS_ENDPOINT to the Vercel project's environment."

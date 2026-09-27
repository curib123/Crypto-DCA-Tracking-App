#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${NEXTFI_APP_DIR:-$HOME/nextfi}"
ENV_FILE="$APP_DIR/.env"

cd "$APP_DIR"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

env_value() {
  local key="$1"
  local line
  line="$(grep -E "^[[:space:]]*${key}=" "$ENV_FILE" | tail -n 1 || true)"
  line="${line#*=}"
  line="${line%$'\r'}"

  if [[ "${line:0:1}" == '"' && "${line: -1}" == '"' ]]; then
    line="${line:1:-1}"
  elif [[ "${line:0:1}" == "'" && "${line: -1}" == "'" ]]; then
    line="${line:1:-1}"
  fi

  printf '%s' "$line"
}

required_vars=(
  APP_DOMAIN
  POSTGRES_DB
  POSTGRES_USER
  POSTGRES_PASSWORD
  JWT_SECRET
  CONTROL_PANEL_USERNAME
  CONTROL_PANEL_PASSWORD
  CONTROL_PANEL_JWT_SECRET
  GOOGLE_CLIENT_ID
  NEXT_PUBLIC_GOOGLE_CLIENT_ID
)

for key in "${required_vars[@]}"; do
  value="$(env_value "$key")"
  if [[ -z "$value" ]]; then
    echo "Required production variable is missing: $key" >&2
    exit 1
  fi
done

APP_DOMAIN="$(env_value APP_DOMAIN)"
JWT_SECRET="$(env_value JWT_SECRET)"
CONTROL_PANEL_PASSWORD="$(env_value CONTROL_PANEL_PASSWORD)"
CONTROL_PANEL_JWT_SECRET="$(env_value CONTROL_PANEL_JWT_SECRET)"

if [[ "$CONTROL_PANEL_PASSWORD" == "pass" ]]; then
  echo "CONTROL_PANEL_PASSWORD must not use the development default in production." >&2
  exit 1
fi

if [[ ${#JWT_SECRET} -lt 32 || ${#CONTROL_PANEL_JWT_SECRET} -lt 32 ]]; then
  echo "JWT secrets must be at least 32 characters." >&2
  exit 1
fi

compose() {
  if docker info >/dev/null 2>&1; then
    docker compose --env-file "$ENV_FILE" "$@"
  else
    sudo docker compose --env-file "$ENV_FILE" "$@"
  fi
}

compose -f docker-compose.prod.yml config --quiet
compose -f docker-compose.prod.yml pull --ignore-buildable || true
compose -f docker-compose.prod.yml build --pull
compose -f docker-compose.prod.yml up -d --remove-orphans

echo "Waiting for NextFi API container..."
for attempt in $(seq 1 60); do
  if compose -f docker-compose.prod.yml exec -T api     sh -lc 'node -e "fetch(\"http://127.0.0.1:4000/api/health\").then(r=>{if(!r.ok)process.exit(1);return r.json()}).then(j=>{if(j.status!==\"ok\")process.exit(1)}).catch(()=>process.exit(1))"'     >/dev/null 2>&1; then
    break
  fi

  if [[ "$attempt" -eq 60 ]]; then
    compose -f docker-compose.prod.yml ps
    compose -f docker-compose.prod.yml logs --tail=120 api web caddy
    echo "Deployment health check failed." >&2
    exit 1
  fi

  sleep 3
done

compose -f docker-compose.prod.yml ps

if command -v curl >/dev/null 2>&1; then
  echo "Checking public HTTPS endpoint..."
  for attempt in $(seq 1 40); do
    if curl --fail --silent --show-error --max-time 10       "https://$APP_DOMAIN/api/health" >/dev/null 2>&1; then
      echo "NextFi is live at https://$APP_DOMAIN"
      break
    fi

    if [[ "$attempt" -eq 40 ]]; then
      echo "Containers are healthy, but the public HTTPS endpoint is not reachable yet."
      echo "Check DNS A record and Oracle ingress rules for ports 80/443."
    fi

    sleep 3
  done
fi

compose image prune -f || true

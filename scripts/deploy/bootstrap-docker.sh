#!/usr/bin/env bash
set -euo pipefail

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "Docker and Docker Compose are already installed."
  exit 0
fi

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required for the first-time Docker installation." >&2
  exit 1
fi

source /etc/os-release

case "${ID:-}" in
  ubuntu|debian)
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl gnupg
    sudo install -m 0755 -d /etc/apt/keyrings

    distro="debian"
    [[ "${ID}" == "ubuntu" ]] && distro="ubuntu"

    curl -fsSL "https://download.docker.com/linux/${distro}/gpg" |
      sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

    echo       "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${distro} ${VERSION_CODENAME} stable" |
      sudo tee /etc/apt/sources.list.d/docker.list >/dev/null

    sudo chmod a+r /etc/apt/keyrings/docker.gpg
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER" || true
    ;;
  *)
    echo "Unsupported OS for automatic Docker bootstrap: ${ID:-unknown}" >&2
    echo "Use Ubuntu/Debian or install Docker Engine + Docker Compose manually." >&2
    exit 1
    ;;
esac

sudo docker version
sudo docker compose version

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

install_compose_plugin() {
  local version="${DOCKER_COMPOSE_VERSION:-v5.5.1}"
  local arch
  arch="$(uname -m)"

  case "$arch" in
    x86_64|aarch64)
      ;;
    arm64)
      arch="aarch64"
      ;;
    *)
      echo "Unsupported architecture for Docker Compose: $arch" >&2
      exit 1
      ;;
  esac

  sudo mkdir -p /usr/local/lib/docker/cli-plugins
  sudo curl -fsSL     "https://github.com/docker/compose/releases/download/${version}/docker-compose-linux-${arch}"     -o /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chown root:root /usr/local/lib/docker/cli-plugins/docker-compose
  sudo chmod 0755 /usr/local/lib/docker/cli-plugins/docker-compose
}

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

  amzn)
    sudo dnf install -y docker curl
    sudo systemctl enable --now docker
    sudo usermod -aG docker "$USER" || true

    if ! sudo docker compose version >/dev/null 2>&1; then
      install_compose_plugin
    fi
    ;;

  *)
    echo "Unsupported OS for automatic Docker bootstrap: ${ID:-unknown}" >&2
    echo "Supported: Ubuntu, Debian, Amazon Linux 2023." >&2
    exit 1
    ;;
esac

sudo docker version
sudo docker compose version

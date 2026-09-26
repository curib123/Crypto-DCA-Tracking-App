#!/usr/bin/env sh
set -eu

sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
sudo sh /tmp/get-docker.sh
rm /tmp/get-docker.sh
sudo usermod -aG docker "$USER"

echo ""
echo "Docker is installed."
echo "Sign out and back in once so your user receives Docker group access."
echo "Then clone the repository, copy .env.example to .env, set APP_DOMAIN and strong secrets,"
echo "and run: docker compose -f docker-compose.prod.yml up -d --build"

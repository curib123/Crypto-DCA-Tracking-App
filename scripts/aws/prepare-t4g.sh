#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -m)" != "aarch64" && "$(uname -m)" != "arm64" ]]; then
  echo "Warning: expected ARM64 for t4g.small, detected $(uname -m)."
fi

total_mem_kb="$(awk '/MemTotal/ {print $2}' /proc/meminfo)"
swap_total_kb="$(awk '/SwapTotal/ {print $2}' /proc/meminfo)"

if [[ "${total_mem_kb:-0}" -le 3145728 && "${swap_total_kb:-0}" -lt 1048576 ]]; then
  echo "Configuring 2 GiB swap for low-memory Docker builds..."

  if [[ ! -f /swapfile ]]; then
    if command -v fallocate >/dev/null 2>&1; then
      sudo fallocate -l 2G /swapfile
    else
      sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=progress
    fi
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
  fi

  sudo swapon /swapfile || true

  if ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  fi
else
  echo "Swap is already sufficient or instance memory is above the low-memory threshold."
fi

free -h || true

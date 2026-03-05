#!/usr/bin/env bash
# KinBot installer
# Usage: curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash
# Or:    KINBOT_PORT=8080 bash install.sh
# Non-interactive: KINBOT_NO_PROMPT=true bash install.sh
set -euo pipefail

# ─── Root detection ──────────────────────────────────────────────────────────
IS_ROOT=false
[ "$(id -u)" -eq 0 ] && IS_ROOT=true

# ─── Configurable via env vars ───────────────────────────────────────────────
if [ "$IS_ROOT" = true ]; then
  KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
  KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  KINBOT_USER="${KINBOT_USER:-kinbot}"
else
  KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
  KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
fi

KINBOT_PORT="${KINBOT_PORT:-3000}"
KINBOT_PUBLIC_URL="${KINBOT_PUBLIC_URL:-}"
KINBOT_REPO="MarlBurroW/kinbot"
KINBOT_BRANCH="${KINBOT_BRANCH:-main}"
KINBOT_DRY_RUN=false
KINBOT_QUIET="${KINBOT_QUIET:-false}"
KINBOT_START_TIME=""
KINBOT_YES="${KINBOT_YES:-false}"

# ─── Colors (auto-detect terminal support) ───────────────────────────────────
setup_colors() {
  if [ "${NO_COLOR:-}" = "1" ] || [ "${KINBOT_NO_COLOR:-}" = "true" ]; then
    RED='' GREEN='' YELLOW='' CYAN='' DIM='' BOLD='' NC=''
  elif [ -t 1 ] && [ -t 2 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    DIM='\033[2m'
    BOLD='\033[1m'
    NC='\033[0m'
  else
    # Not a terminal (piped or redirected) — no colors
    RED='' GREEN='' YELLOW='' CYAN='' DIM='' BOLD='' NC=''
  fi
}
setup_colors

info()    { [ "$KINBOT_QUIET" = true ] && return; echo -e "${CYAN}▸${NC} $*"; }
success() { [ "$KINBOT_QUIET" = true ] && return; echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*" >&2; }
error()   { echo -e "${RED}✗ ERROR:${NC} $*" >&2; exit 1; }
header()  { [ "$KINBOT_QUIET" = true ] && return; echo -e "\n${BOLD}$*${NC}"; }

# ─── Elapsed time tracking ──────────────────────────────────────────────────
start_timer() { KINBOT_START_TIME="$(date +%s)"; }

# Returns human-readable elapsed time since start_timer() was called
format_elapsed() {
  [ -z "$KINBOT_START_TIME" ] && return
  local now elapsed
  now="$(date +%s)"
  elapsed=$((now - KINBOT_START_TIME))
  if [ "$elapsed" -lt 5 ] 2>/dev/null; then
    echo "< 5s"
  elif [ "$elapsed" -lt 60 ] 2>/dev/null; then
    echo "${elapsed}s"
  elif [ "$elapsed" -lt 3600 ] 2>/dev/null; then
    local m=$((elapsed / 60)) s=$((elapsed % 60))
    if [ "$s" -gt 0 ]; then
      echo "${m}m ${s}s"
    else
      echo "${m}m"
    fi
  else
    local h=$((elapsed / 3600)) m=$(( (elapsed % 3600) / 60 ))
    echo "${h}h ${m}m"
  fi
}

# ─── Step progress (for main install flow) ───────────────────────────────────
STEP_CURRENT=0
STEP_TOTAL=0

step() {
  STEP_CURRENT=$((STEP_CURRENT + 1))
  [ "$KINBOT_QUIET" = true ] && return
  local progress=""
  if [ "$STEP_TOTAL" -gt 0 ] 2>/dev/null; then
    progress="${DIM}[${STEP_CURRENT}/${STEP_TOTAL}]${NC} "
  fi
  echo -e "\n${progress}${BOLD}$*${NC}"
}

# ─── Installer self-update check ─────────────────────────────────────────────
# When running from a local file (not piped via curl | bash), check if the
# installer itself is outdated compared to the remote version on GitHub.
# This prevents users from running stale install logic against a newer codebase.
check_installer_update() {
  # Skip if piped (no local file to update), quiet mode, CI, or no-prompt
  [ ! -t 0 ] && return 0
  [ "$KINBOT_QUIET" = true ] && return 0
  [ "${KINBOT_NO_PROMPT:-}" = "true" ] && return 0
  [ "${CI:-}" = "true" ] && return 0
  [ "${KINBOT_SKIP_SELF_UPDATE:-}" = "true" ] && return 0

  # Only check if we can identify the running script file
  local self_path="${BASH_SOURCE[0]:-}"
  [ -z "$self_path" ] && return 0
  [ ! -f "$self_path" ] && return 0

  # Compute local checksum
  local local_hash=""
  if command -v sha256sum &>/dev/null; then
    local_hash="$(sha256sum "$self_path" 2>/dev/null | awk '{print $1}')"
  elif command -v shasum &>/dev/null; then
    local_hash="$(shasum -a 256 "$self_path" 2>/dev/null | awk '{print $1}')"
  else
    return 0  # can't compare without a hash tool
  fi
  [ -z "$local_hash" ] && return 0

  # Fetch remote installer (lightweight: just the hash via a temp file)
  local remote_url="https://raw.githubusercontent.com/$KINBOT_REPO/$KINBOT_BRANCH/install.sh"
  local tmp_remote
  tmp_remote="$(mktemp)"

  if ! curl -fsSL --max-time 8 "$remote_url" -o "$tmp_remote" 2>/dev/null; then
    rm -f "$tmp_remote"
    return 0  # network issue, skip silently
  fi

  local remote_hash=""
  if command -v sha256sum &>/dev/null; then
    remote_hash="$(sha256sum "$tmp_remote" 2>/dev/null | awk '{print $1}')"
  elif command -v shasum &>/dev/null; then
    remote_hash="$(shasum -a 256 "$tmp_remote" 2>/dev/null | awk '{print $1}')"
  fi

  if [ -z "$remote_hash" ] || [ "$local_hash" = "$remote_hash" ]; then
    rm -f "$tmp_remote"
    return 0  # up to date or can't compare
  fi

  # Installer is outdated
  echo -e "${YELLOW}⚠${NC} A newer version of the installer is available."
  echo -en "  ${CYAN}?${NC} ${BOLD}Update installer and restart?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
  local answer
  read -r answer </dev/tty || answer="y"
  [ -z "$answer" ] && answer="y"

  if [[ "$answer" =~ ^[Yy]$ ]]; then
    cp "$tmp_remote" "$self_path"
    chmod +x "$self_path"
    rm -f "$tmp_remote"
    success "Installer updated"
    # Re-exec with same arguments, skip self-update to avoid loop
    KINBOT_SKIP_SELF_UPDATE=true exec bash "$self_path" "$@"
  fi

  rm -f "$tmp_remote"
}

# ─── Cleanup & signal handling ───────────────────────────────────────────────
SPINNER_PID=""
SPINNER_LOG=""
INTERRUPTED=false

cleanup_on_signal() {
  INTERRUPTED=true
  echo "" >&2

  # Kill any running spinner background command
  if [ -n "$SPINNER_PID" ] && kill -0 "$SPINNER_PID" 2>/dev/null; then
    kill "$SPINNER_PID" 2>/dev/null
    wait "$SPINNER_PID" 2>/dev/null || true
  fi
  SPINNER_PID=""

  # Clean spinner line
  printf "\r\033[K" >&2

  # Remove temp log file
  [ -n "$SPINNER_LOG" ] && rm -f "$SPINNER_LOG"
  SPINNER_LOG=""

  warn "Interrupted by user"

  release_lock

  # EXIT trap will fire next and handle rollback
  exit 130
}

trap cleanup_on_signal INT TERM

# ─── Spinner for long-running commands ───────────────────────────────────────
# Usage: run_with_spinner "Installing dependencies..." command arg1 arg2
run_with_spinner() {
  local label="$1"
  shift

  # If not a terminal or quiet mode, just run silently
  if [ "$KINBOT_QUIET" = true ]; then
    "$@" >/dev/null 2>&1
    return
  fi
  if [ ! -t 1 ] && [ ! -t 2 ]; then
    info "$label"
    "$@"
    return
  fi

  local frames=("⠋" "⠙" "⠹" "⠸" "⠼" "⠴" "⠦" "⠧" "⠇" "⠏")
  local frame_count=${#frames[@]}
  local i=0
  SPINNER_LOG="$(mktemp)"

  # Start the command in background, capturing output
  "$@" > "$SPINNER_LOG" 2>&1 &
  local cmd_pid=$!
  SPINNER_PID=$cmd_pid

  # Animate spinner while command runs
  while kill -0 "$cmd_pid" 2>/dev/null; do
    printf "\r  ${CYAN}%s${NC} %s" "${frames[$((i % frame_count))]}" "$label" >&2
    i=$((i + 1))
    sleep 0.1
  done

  # Get exit code
  wait "$cmd_pid"
  local exit_code=$?
  SPINNER_PID=""

  # Clear spinner line
  printf "\r\033[K" >&2

  if [ $exit_code -eq 0 ]; then
    success "$label"
  else
    echo -e "${RED}✗${NC} $label" >&2
    echo "" >&2
    echo -e "${DIM}Command output:${NC}" >&2
    tail -20 "$SPINNER_LOG" >&2
    rm -f "$SPINNER_LOG"
    SPINNER_LOG=""
    return $exit_code
  fi

  rm -f "$SPINNER_LOG"
  SPINNER_LOG=""
  return 0
}

# ─── Retry wrapper for flaky network operations ─────────────────────────────
# Usage: retry <max_attempts> <label> command arg1 arg2 ...
# Retries with exponential backoff (2s, 4s, 8s, ...) on failure.
retry() {
  local max_attempts="$1"
  local label="$2"
  shift 2

  local attempt=1
  local delay=2

  while true; do
    if "$@" 2>&1; then
      return 0
    fi

    if [ $attempt -ge "$max_attempts" ]; then
      return 1
    fi

    warn "$label failed (attempt $attempt/$max_attempts) — retrying in ${delay}s..."
    sleep $delay
    delay=$((delay * 2))
    attempt=$((attempt + 1))
  done
}

# ─── Lockfile (prevent concurrent installer runs) ────────────────────────────
# Running two installers at the same time (e.g. two cron-triggered updates,
# or a user running install while an update is in progress) can corrupt the
# build, git state, or database. We use a lockfile to serialize access.
KINBOT_LOCKFILE=""

acquire_lock() {
  local lock_dir="${TMPDIR:-/tmp}"
  KINBOT_LOCKFILE="$lock_dir/kinbot-installer.lock"

  # Try to create the lockfile atomically
  if ( set -o noclobber; echo "$$" > "$KINBOT_LOCKFILE" ) 2>/dev/null; then
    # We got the lock — register cleanup
    return 0
  fi

  # Lockfile exists — check if the holder is still alive
  local holder_pid
  holder_pid="$(cat "$KINBOT_LOCKFILE" 2>/dev/null || echo "")"

  if [ -n "$holder_pid" ] && kill -0 "$holder_pid" 2>/dev/null; then
    error "Another installer is already running (PID $holder_pid). Wait for it to finish or remove $KINBOT_LOCKFILE"
  fi

  # Stale lockfile — previous run crashed without cleanup
  warn "Removing stale lockfile (previous PID $holder_pid is gone)"
  rm -f "$KINBOT_LOCKFILE"

  if ( set -o noclobber; echo "$$" > "$KINBOT_LOCKFILE" ) 2>/dev/null; then
    return 0
  fi

  # Race condition: another process grabbed it between our rm and write
  error "Another installer is already running. Wait for it to finish or remove $KINBOT_LOCKFILE"
}

release_lock() {
  if [ -n "${KINBOT_LOCKFILE:-}" ] && [ -f "${KINBOT_LOCKFILE:-}" ]; then
    # Only remove if we own it
    local holder_pid
    holder_pid="$(cat "$KINBOT_LOCKFILE" 2>/dev/null || echo "")"
    if [ "$holder_pid" = "$$" ]; then
      rm -f "$KINBOT_LOCKFILE"
    fi
  fi
  KINBOT_LOCKFILE=""
}

# ─── OS detection ────────────────────────────────────────────────────────────
detect_os() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  # Detect WSL
  IS_WSL=false
  if [ -f /proc/version ] && grep -qi 'microsoft\|wsl' /proc/version 2>/dev/null; then
    IS_WSL=true
  fi

  case "$OS" in
    Linux)
      if [ -f /etc/os-release ]; then
        # shellcheck disable=SC1091
        . /etc/os-release
        DISTRO="${ID:-unknown}"
        DISTRO_LIKE="${ID_LIKE:-}"  # exported for potential use by plugins
      export DISTRO_LIKE
      else
        DISTRO="unknown"
        DISTRO_LIKE=""
      fi
      # Check if systemd is actually available (WSL1 and some containers don't have it)
      if command -v systemctl &>/dev/null && systemctl --version &>/dev/null 2>&1; then
        INIT_SYSTEM="systemd"
      else
        INIT_SYSTEM="script"
      fi
      ;;
    Darwin)
      DISTRO="macos"
      DISTRO_LIKE=""
      INIT_SYSTEM="launchd"
      ;;
    *)
      error "Unsupported OS: $OS. KinBot supports Linux and macOS."
      ;;
  esac

  local os_label="$OS ($DISTRO, $ARCH)"
  if [ "$IS_WSL" = true ]; then
    os_label="$OS ($DISTRO, $ARCH, WSL)"
  fi

  if [ "$IS_ROOT" = true ]; then
    success "Detected OS: $os_label — running as root (system install)"
  else
    success "Detected OS: $os_label — running as $USER (user install)"
  fi

  if [ "$INIT_SYSTEM" = "script" ]; then
    warn "systemd not available — will use a start/stop script instead"
    if [ "$IS_WSL" = true ]; then
      info "WSL detected. Service won't auto-start on boot; use the kinbot script to start manually."
    fi
  fi
}

# ─── Install a system package (sudo only for this) ───────────────────────────
APT_UPDATED=false

install_pkg() {
  local pkg="$1"

  # Verify sudo is available when needed (not root, not brew)
  if [ "$IS_ROOT" != true ] && ! command -v brew &>/dev/null; then
    if ! command -v sudo &>/dev/null; then
      echo "" >&2
      error "$pkg is required but 'sudo' is not available to install it.\n\n  ${BOLD}Fix:${NC} Install $pkg manually as root, then re-run the installer.\n  ${DIM}Example: su -c 'apt-get update && apt-get install -y $pkg'${NC}"
    fi
    # Check that the user can actually sudo (cached credentials or NOPASSWD)
    if ! sudo -n true 2>/dev/null; then
      info "sudo password may be required to install $pkg"
    fi
  fi

  info "Installing $pkg..."
  if command -v apt-get &>/dev/null; then
    # Refresh package cache once per installer run (stale caches cause failures on fresh systems)
    if [ "$APT_UPDATED" != true ]; then
      info "Refreshing package cache..."
      if [ "$IS_ROOT" = true ]; then
        apt-get update -qq 2>/dev/null || warn "apt-get update failed (continuing anyway)"
      else
        sudo apt-get update -qq 2>/dev/null || warn "apt-get update failed (continuing anyway)"
      fi
      APT_UPDATED=true
    fi
    if [ "$IS_ROOT" = true ]; then
      apt-get install -y "$pkg" -q
    else
      sudo apt-get install -y "$pkg" -q
    fi
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y "$pkg" -q
  elif command -v yum &>/dev/null; then
    sudo yum install -y "$pkg" -q
  elif command -v pacman &>/dev/null; then
    sudo pacman -S --noconfirm "$pkg"
  elif command -v apk &>/dev/null; then
    sudo apk add --no-cache "$pkg"
  elif command -v zypper &>/dev/null; then
    sudo zypper install -y "$pkg"
  elif command -v brew &>/dev/null; then
    brew install "$pkg"
  else
    error "$pkg is required but could not be installed automatically. Please install it manually."
  fi
  success "$pkg installed"
}

# ─── Check prerequisites ─────────────────────────────────────────────────────
check_prerequisites() {
  step "Checking prerequisites"

  if ! command -v git &>/dev/null; then
    install_pkg git
  fi
  success "git $(git --version | awk '{print $3}')"

  if ! command -v curl &>/dev/null; then
    install_pkg curl
  fi
  success "curl found"

  # unzip is required by the Bun installer
  if ! command -v unzip &>/dev/null; then
    install_pkg unzip
  fi
  success "unzip found"
}

# ─── Pre-flight checks ───────────────────────────────────────────────────────
preflight_checks() {
  step "Running pre-flight checks"

  # Check available disk space (need ~500MB for clone + deps + build)
  local install_parent
  install_parent="$(dirname "$KINBOT_DIR")"
  mkdir -p "$install_parent" 2>/dev/null || true

  local avail_kb
  if avail_kb="$(df -k "$install_parent" 2>/dev/null | awk 'NR==2 {print $4}')"; then
    if [ -n "$avail_kb" ] && [ "$avail_kb" -lt 512000 ] 2>/dev/null; then
      local avail_mb=$((avail_kb / 1024))
      error "Not enough disk space: ${avail_mb}MB available in $install_parent (need at least 500MB)"
    elif [ -n "$avail_kb" ] && [ "$avail_kb" -lt 1024000 ] 2>/dev/null; then
      local avail_mb=$((avail_kb / 1024))
      warn "Low disk space: ${avail_mb}MB available in $install_parent (recommended: 1GB+)"
    else
      success "Disk space OK"
    fi
  fi

  # Check if target port is already in use (skip on update — our own service may be running)
  if [ -d "$KINBOT_DIR/.git" ]; then
    : # skip port check on update
  elif [ -n "${KINBOT_PORT:-}" ]; then
    local port_in_use=false
    if command -v ss &>/dev/null; then
      ss -tlnp 2>/dev/null | grep -q ":${KINBOT_PORT} " && port_in_use=true
    elif command -v lsof &>/dev/null; then
      lsof -i ":${KINBOT_PORT}" -sTCP:LISTEN &>/dev/null && port_in_use=true
    elif command -v netstat &>/dev/null; then
      netstat -tlnp 2>/dev/null | grep -q ":${KINBOT_PORT} " && port_in_use=true
    fi

    if [ "$port_in_use" = true ]; then
      warn "Port $KINBOT_PORT is already in use. You may need to choose a different port."
      warn "Set KINBOT_PORT=<number> or change it during the configuration step."
    else
      success "Port $KINBOT_PORT is available"
    fi
  fi

  # Check available memory (Bun builds can OOM on small machines)
  if [ "$OS" = "Linux" ] && [ -f /proc/meminfo ]; then
    local mem_total_kb mem_avail_kb swap_total_kb
    mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"
    mem_avail_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"
    swap_total_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"

    if [ -n "$mem_total_kb" ]; then
      local mem_total_mb=$((mem_total_kb / 1024))
      local mem_avail_mb=0
      [ -n "$mem_avail_kb" ] && mem_avail_mb=$((mem_avail_kb / 1024))
      local swap_total_mb=0
      [ -n "$swap_total_kb" ] && swap_total_mb=$((swap_total_kb / 1024))
      local effective_mb=$((mem_avail_mb + swap_total_mb))

      if [ "$mem_total_mb" -lt 512 ] 2>/dev/null; then
        warn "Low total RAM: ${mem_total_mb}MB (minimum 512MB recommended for builds)"
        if [ "$swap_total_mb" -lt 256 ] 2>/dev/null; then
          warn "No swap or very little swap (${swap_total_mb}MB). The build may fail with out-of-memory."
          info "Consider adding swap: sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile"
        else
          info "Swap available (${swap_total_mb}MB) — should help during build"
        fi
      elif [ "$effective_mb" -lt 384 ] 2>/dev/null; then
        warn "Low available memory: ${mem_avail_mb}MB RAM + ${swap_total_mb}MB swap"
        info "Close other processes or add swap if the build fails"
      else
        success "Memory OK (${mem_avail_mb}MB available, ${mem_total_mb}MB total)"
      fi
    fi
  elif [ "$OS" = "Darwin" ]; then
    local mem_bytes
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo "")"
    if [ -n "$mem_bytes" ]; then
      local mem_total_mb=$((mem_bytes / 1024 / 1024))
      success "Memory OK (${mem_total_mb}MB total)"
    fi
  fi

  # Show proxy config if set (useful for debugging corporate/firewall setups)
  if [ -n "${HTTP_PROXY:-}${HTTPS_PROXY:-}${http_proxy:-}${https_proxy:-}" ]; then
    local proxy_url="${HTTPS_PROXY:-${https_proxy:-${HTTP_PROXY:-${http_proxy:-}}}}"
    info "Using proxy: $proxy_url"
  fi

  # Check internet connectivity (needed for git clone and bun install)
  if curl -fsSL --max-time 5 https://github.com >/dev/null 2>&1; then
    success "Internet connectivity OK"
  else
    # Provide more helpful diagnostics
    if ! host github.com &>/dev/null 2>&1 && ! nslookup github.com &>/dev/null 2>&1; then
      error "DNS resolution failed for github.com. Check your network/DNS settings."
    elif [ -n "${HTTP_PROXY:-}${HTTPS_PROXY:-}${http_proxy:-}${https_proxy:-}" ]; then
      error "Cannot reach github.com through proxy. Verify your proxy settings."
    else
      error "Cannot reach github.com. Check your internet connection and firewall settings."
    fi
  fi

  # Detect container environments (Docker, Podman, LXC, etc.)
  local in_container=false
  local container_type=""

  if [ -f /.dockerenv ]; then
    in_container=true
    container_type="Docker"
  elif [ -f /run/.containerenv ]; then
    in_container=true
    container_type="Podman"
  elif grep -qa 'docker\|containerd' /proc/1/cgroup 2>/dev/null; then
    in_container=true
    container_type="Docker"
  elif grep -qa 'lxc' /proc/1/cgroup 2>/dev/null; then
    in_container=true
    container_type="LXC"
  elif [ -f /proc/1/sched ] 2>/dev/null; then
    local pid1_name
    pid1_name="$(head -1 /proc/1/sched 2>/dev/null | awk '{print $1}')"
    if [ -n "$pid1_name" ] && [ "$pid1_name" != "systemd" ] && [ "$pid1_name" != "init" ]; then
      # PID 1 is not init/systemd, likely a container
      in_container=true
      container_type="container"
    fi
  fi

  if [ "$in_container" = true ]; then
    warn "Running inside a $container_type environment"

    # If this is a fresh install (not --docker mode), suggest Docker mode instead
    if [ ! -d "$KINBOT_DIR/.git" ]; then
      info "Consider using ${BOLD}bash install.sh --docker${NC} instead, which generates"
      info "a docker-compose.yml and avoids building inside the container."
    fi

    if [ "$INIT_SYSTEM" = "script" ]; then
      info "systemd is not available; a start/stop script will be used."
      info "The service won't auto-restart. Use a container restart policy or supervisor."
    fi
  fi
}

# ─── Interactive prompt (works with curl | bash via /dev/tty) ─────────────────
# Usage: prompt_value VAR_NAME "Question" "default value"
prompt_value() {
  local var_name="$1"
  local question="$2"
  local default="$3"
  local answer

  # Auto-accept defaults in non-interactive / --yes mode
  if [ "$KINBOT_YES" = true ] || [ "${KINBOT_NO_PROMPT:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    printf -v "$var_name" '%s' "$default"
    return
  fi

  echo -en "  ${CYAN}?${NC} ${BOLD}${question}${NC} ${DIM}[${default}]${NC}: " >/dev/tty
  read -r answer </dev/tty || answer=""

  if [ -z "$answer" ]; then
    answer="$default"
  fi

  printf -v "$var_name" '%s' "$answer"
}

# ─── Detect local IP ─────────────────────────────────────────────────────────
detect_local_ip() {
  if [ "$OS" = "Linux" ]; then
    hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost"
  else
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost"
  fi
}

# ─── Configuration wizard ────────────────────────────────────────────────────
configure() {
  local env_file="$KINBOT_DATA_DIR/kinbot.env"

  # Skip on update if config already exists — don't overwrite user's settings
  if [ "${IS_UPDATE:-false}" = true ] && [ -f "$env_file" ]; then
    info "Existing config found at $env_file — keeping it"
    # Still read the port from it for the summary
    # shellcheck disable=SC1090
    . "$env_file" 2>/dev/null || true
    KINBOT_PORT="${PORT:-$KINBOT_PORT}"
    KINBOT_PUBLIC_URL="${PUBLIC_URL:-$KINBOT_PUBLIC_URL}"
    # Fallback: build URL from local IP if still empty
    if [ -z "$KINBOT_PUBLIC_URL" ]; then
      local local_ip
      local_ip="$(detect_local_ip)"
      KINBOT_PUBLIC_URL="http://${local_ip}:${KINBOT_PORT}"
    fi
    return
  fi

  # Skip wizard if env vars already set or non-interactive
  local skip_wizard=false
  [ "${KINBOT_NO_PROMPT:-}" = "true" ] && skip_wizard=true
  [ "${CI:-}" = "true" ] && skip_wizard=true
  # If all key vars were explicitly set via env, no need to ask
  [ -n "${KINBOT_PORT_EXPLICIT:-}" ] && [ -n "${KINBOT_PUBLIC_URL}" ] && skip_wizard=true

  if [ "$skip_wizard" = true ]; then
    : # use defaults / env vars as-is
  else
    local local_ip
    local_ip="$(detect_local_ip)"

    echo ""
    echo -e "${BOLD}Configuration${NC}"
    echo -e "${DIM}Press Enter to accept the default value shown in brackets.${NC}"
    echo ""

    prompt_value KINBOT_PORT "Port" "$KINBOT_PORT"

    local default_url="http://${local_ip}:${KINBOT_PORT}"
    [ -n "$KINBOT_PUBLIC_URL" ] && default_url="$KINBOT_PUBLIC_URL"
    prompt_value KINBOT_PUBLIC_URL "Public URL (for webhooks & invite links)" "$default_url"
  fi

  # Fallback if public URL still empty
  if [ -z "$KINBOT_PUBLIC_URL" ]; then
    local local_ip
    local_ip="$(detect_local_ip)"
    KINBOT_PUBLIC_URL="http://${local_ip}:${KINBOT_PORT}"
  fi

  # Write config file
  mkdir -p "$KINBOT_DATA_DIR"
  cat > "$env_file" << ENV
# KinBot configuration — generated by installer
# Edit this file to change settings, then restart: systemctl --user restart kinbot
NODE_ENV=production
PORT=${KINBOT_PORT}
HOST=0.0.0.0
KINBOT_DATA_DIR=${KINBOT_DATA_DIR}
PUBLIC_URL=${KINBOT_PUBLIC_URL}
ENV
  chmod 600 "$env_file"
  success "Config written to $env_file"
}

# ─── Install Bun ─────────────────────────────────────────────────────────────
# Minimum Bun version required (lockfileVersion 1 needs Bun 1.2+)
BUN_MIN_VERSION="1.2.0"

# Compare two semver strings: returns 0 if $1 >= $2, 1 otherwise
version_gte() {
  local IFS='.'
  local -a v1 v2
  IFS='.' read -ra v1 <<< "$1"
  IFS='.' read -ra v2 <<< "$2"
  local i
  for i in 0 1 2; do
    local a="${v1[$i]:-0}" b="${v2[$i]:-0}"
    if [ "$a" -gt "$b" ] 2>/dev/null; then return 0; fi
    if [ "$a" -lt "$b" ] 2>/dev/null; then return 1; fi
  done
  return 0
}

ensure_bun() {
  step "Checking Bun runtime"

  # Validate architecture — Bun only supports x86_64 and aarch64 (ARM64)
  case "$ARCH" in
    x86_64|amd64)
      : # supported
      ;;
    aarch64|arm64)
      : # supported
      ;;
    armv7l|armv6l|armhf)
      echo ""
      error "Bun does not support 32-bit ARM ($ARCH).\n\n" \
            " KinBot requires Bun, which only runs on x86_64 or ARM64 (aarch64).\n" \
            " If you're on a Raspberry Pi, you need a 64-bit OS:\n" \
            "   ${DIM}• Raspberry Pi OS (64-bit): https://www.raspberrypi.com/software/${NC}\n" \
            "   ${DIM}• Ubuntu Server 64-bit for Pi: https://ubuntu.com/download/raspberry-pi${NC}\n\n" \
            " Alternatively, use Docker (which handles architecture natively):\n" \
            "   ${DIM}bash install.sh --docker${NC}"
      ;;
    i386|i686)
      error "Bun does not support 32-bit x86 ($ARCH).\n\n" \
            " KinBot requires a 64-bit system (x86_64 or ARM64).\n" \
            " Alternatively, use Docker: ${DIM}bash install.sh --docker${NC}"
      ;;
    *)
      warn "Unknown architecture: $ARCH. Bun may not be available for this platform."
      warn "If Bun installation fails, try Docker instead: bash install.sh --docker"
      ;;
  esac

  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export BUN_INSTALL
  export PATH="$BUN_INSTALL/bin:$PATH"

  if command -v bun &>/dev/null; then
    local current_version
    current_version="$(bun --version 2>/dev/null || echo "0.0.0")"

    if version_gte "$current_version" "$BUN_MIN_VERSION"; then
      success "Bun v${current_version}"
      return 0
    fi

    warn "Bun v${current_version} is too old (need v${BUN_MIN_VERSION}+)"
    info "Upgrading Bun..."
    run_with_spinner "Upgrading Bun..." retry 3 "Bun upgrade" bash -c 'curl -fsSL https://bun.sh/install | bash'
    export PATH="$BUN_INSTALL/bin:$PATH"
    hash -r 2>/dev/null || true

    local new_version
    new_version="$(bun --version 2>/dev/null || echo "0.0.0")"
    if version_gte "$new_version" "$BUN_MIN_VERSION"; then
      success "Bun upgraded: v${current_version} → v${new_version}"
    else
      error "Bun upgrade failed (got v${new_version}, need v${BUN_MIN_VERSION}+). Upgrade manually: https://bun.sh"
    fi
    return 0
  fi

  info "Installing Bun..."
  run_with_spinner "Downloading and installing Bun..." retry 3 "Bun install" bash -c 'curl -fsSL https://bun.sh/install | bash'
  export PATH="$BUN_INSTALL/bin:$PATH"

  command -v bun &>/dev/null || error "Bun installation failed. Install manually: https://bun.sh"

  local installed_version
  installed_version="$(bun --version 2>/dev/null || echo "0.0.0")"
  if ! version_gte "$installed_version" "$BUN_MIN_VERSION"; then
    error "Installed Bun v${installed_version} is below minimum v${BUN_MIN_VERSION}. Please update manually: https://bun.sh"
  fi
  success "Bun v${installed_version} installed"
}

# ─── Backup database before update ───────────────────────────────────────────
BACKUP_DB_PATH=""

backup_database() {
  local db_file="$KINBOT_DATA_DIR/kinbot.db"
  [ ! -f "$db_file" ] && return

  local backup_dir="$KINBOT_DATA_DIR/backups"
  mkdir -p "$backup_dir"

  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local version_tag
  version_tag="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
  # Sanitize version for filename
  version_tag="$(echo "$version_tag" | tr '/' '-')"

  BACKUP_DB_PATH="$backup_dir/kinbot-${version_tag}-${timestamp}.db"

  # Use sqlite3 .backup if available (safe even if DB is in use), else cp
  if command -v sqlite3 &>/dev/null; then
    if sqlite3 "$db_file" ".backup '$BACKUP_DB_PATH'" 2>/dev/null; then
      success "Database backed up (sqlite3): $(basename "$BACKUP_DB_PATH")"
    else
      cp "$db_file" "$BACKUP_DB_PATH"
      success "Database backed up (copy): $(basename "$BACKUP_DB_PATH")"
    fi
  else
    cp "$db_file" "$BACKUP_DB_PATH"
    success "Database backed up (copy): $(basename "$BACKUP_DB_PATH")"
  fi

  # Also backup WAL/SHM if they exist (for cp-based backups)
  if [ -f "${db_file}-wal" ]; then cp "${db_file}-wal" "${BACKUP_DB_PATH}-wal" 2>/dev/null || true; fi
  if [ -f "${db_file}-shm" ]; then cp "${db_file}-shm" "${BACKUP_DB_PATH}-shm" 2>/dev/null || true; fi

  # Prune old backups: keep last 5
  local count
  count="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
  if [ "$count" -gt 5 ] 2>/dev/null; then
    find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f -printf '%T@ %p\n' 2>/dev/null \
      | sort -n \
      | head -n "$((count - 5))" \
      | awk '{print $2}' \
      | while IFS= read -r old; do
          rm -f "$old" "${old}-wal" "${old}-shm"
        done
    info "Pruned old backups (keeping last 5)"
  fi
}

# ─── Clone or update ─────────────────────────────────────────────────────────
ROLLBACK_COMMIT=""

install_or_update() {
  step "Installing KinBot"

  if [ -d "$KINBOT_DIR/.git" ]; then
    info "Existing installation found at $KINBOT_DIR — updating..."

    # Backup database before update
    backup_database

    # Save current commit for rollback on failure
    ROLLBACK_COMMIT="$(git -C "$KINBOT_DIR" rev-parse HEAD 2>/dev/null || echo "")"
    local old_version
    old_version="$(get_installed_version)"
    if [ -n "$ROLLBACK_COMMIT" ]; then
      info "Current version: $old_version (rollback point: ${ROLLBACK_COMMIT:0:8})"
    fi

    retry 3 "git fetch" git -C "$KINBOT_DIR" fetch origin
    git -C "$KINBOT_DIR" checkout "$KINBOT_BRANCH"
    retry 3 "git pull" git -C "$KINBOT_DIR" pull origin "$KINBOT_BRANCH"

    local new_version
    new_version="$(get_installed_version)"
    if [ "$old_version" = "$new_version" ]; then
      success "Already up to date ($new_version)"
    else
      success "Updated: $old_version → $new_version"
      # Show what changed (categorized by type)
      if [ -n "$ROLLBACK_COMMIT" ]; then
        echo ""
        show_categorized_commits "${ROLLBACK_COMMIT}..HEAD" 5 || true
      fi
    fi
    IS_UPDATE=true
  else
    mkdir -p "$(dirname "$KINBOT_DIR")"
    run_with_spinner "Cloning KinBot to $KINBOT_DIR..." retry 3 "git clone" git clone "https://github.com/$KINBOT_REPO.git" "$KINBOT_DIR" --branch "$KINBOT_BRANCH" --depth 1
    IS_UPDATE=false
  fi
}

# ─── Rollback on failure ────────────────────────────────────────────────────
rollback() {
  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    return
  fi

  echo ""
  if [ "$INTERRUPTED" = true ]; then
    echo -e "${RED}${BOLD}Installation interrupted!${NC}"
  else
    echo -e "${RED}${BOLD}Installation failed!${NC}"
  fi

  # Rollback git to previous commit on update
  if [ -n "${ROLLBACK_COMMIT:-}" ] && [ -d "$KINBOT_DIR/.git" ]; then
    echo ""
    warn "Rolling back to previous version (${ROLLBACK_COMMIT:0:8})..."
    if git -C "$KINBOT_DIR" reset --hard "$ROLLBACK_COMMIT" &>/dev/null; then
      success "Code rolled back to ${ROLLBACK_COMMIT:0:8}"

      # Try to rebuild the old version so the service can restart
      info "Rebuilding previous version..."
      BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
      export PATH="$BUN_INSTALL/bin:$PATH"
      if command -v bun &>/dev/null; then
        cd "$KINBOT_DIR"
        if bun install --frozen-lockfile &>/dev/null && bun run build &>/dev/null; then
          success "Previous version rebuilt"
        else
          warn "Could not rebuild previous version — manual intervention needed"
        fi
      fi

      # Restart the service if it was running
      if [ "${IS_UPDATE:-false}" = true ]; then
        info "Restarting service with previous version..."
        if [ "${INIT_SYSTEM:-}" = "launchd" ]; then
          local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
          [ -f "$plist" ] && launchctl load "$plist" 2>/dev/null
        elif [ "${INIT_SYSTEM:-}" = "script" ]; then
          local script_path="$KINBOT_DIR/kinbot"
          if [ -x "$script_path" ]; then "$script_path" start 2>/dev/null || true; fi
        elif [ "${IS_ROOT:-false}" = true ]; then
          systemctl start kinbot 2>/dev/null || true
        else
          systemctl --user start kinbot 2>/dev/null || true
        fi
        success "Service restarted with previous version"
      fi
    else
      warn "Rollback failed — manual intervention needed"
      warn "Try: cd $KINBOT_DIR && git reset --hard $ROLLBACK_COMMIT"
    fi
  elif [ "${IS_UPDATE:-false}" != true ] && [ -d "$KINBOT_DIR" ]; then
    # Fresh install failed — clean up the partial clone
    warn "Cleaning up partial installation..."
    rm -rf "$KINBOT_DIR"
    success "Removed $KINBOT_DIR"
  fi

  # Mention database backup if one was made
  if [ -n "${BACKUP_DB_PATH:-}" ] && [ -f "${BACKUP_DB_PATH:-}" ]; then
    echo ""
    info "Database backup is available at: $BACKUP_DB_PATH"
    info "To restore: cp '$BACKUP_DB_PATH' '$KINBOT_DATA_DIR/kinbot.db'"
  fi

  echo ""
  echo -e "${RED}Please check the error above and try again.${NC}"
  echo -e "${DIM}If the problem persists, open an issue: https://github.com/$KINBOT_REPO/issues${NC}"
  echo ""

  release_lock
}

# ─── Build ───────────────────────────────────────────────────────────────────
build_kinbot() {
  step "Installing dependencies and building"

  cd "$KINBOT_DIR"
  run_with_spinner "Installing dependencies..." retry 3 "bun install" bun install --frozen-lockfile
  run_with_spinner "Building KinBot..." bun run build
}

# ─── Database ────────────────────────────────────────────────────────────────
setup_database() {
  step "Setting up database"

  mkdir -p "$KINBOT_DATA_DIR"

  cd "$KINBOT_DIR"
  run_with_spinner "Running database migrations..." env KINBOT_DATA_DIR="$KINBOT_DATA_DIR" DB_PATH="$KINBOT_DATA_DIR/kinbot.db" bun run db:migrate
}

# ─── System user + ownership (root only) ─────────────────────────────────────
setup_system_user() {
  [ "$IS_ROOT" != true ] && return

  if ! id "$KINBOT_USER" &>/dev/null; then
    info "Creating system user '$KINBOT_USER'..."
    useradd \
      --system \
      --home-dir "$KINBOT_DIR" \
      --shell /usr/sbin/nologin \
      --comment "KinBot service account" \
      "$KINBOT_USER"
    success "User '$KINBOT_USER' created"
  else
    success "User '$KINBOT_USER' already exists"
  fi

  chown -R "$KINBOT_USER:$KINBOT_USER" "$KINBOT_DIR" "$KINBOT_DATA_DIR"
  success "Permissions set"
}

# ─── Resolve Bun path ────────────────────────────────────────────────────────
resolve_bun_path() {
  BUN_BIN="$(command -v bun)"

  if [ "$IS_ROOT" = true ] && [ "$BUN_BIN" != "/usr/local/bin/bun" ]; then
    ln -sf "$BUN_BIN" /usr/local/bin/bun
    BUN_BIN="/usr/local/bin/bun"
    success "Bun symlinked to /usr/local/bin/bun"
  fi
}

# ─── Service: systemd system (root) ──────────────────────────────────────────
create_systemd_system_service() {
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  UNIT_FILE="/etc/systemd/system/kinbot.service"

  if [ "$IS_UPDATE" = true ] && systemctl is-active --quiet kinbot 2>/dev/null; then
    info "Stopping existing service..."
    systemctl stop kinbot
  fi

  cat > "$UNIT_FILE" << UNIT
[Unit]
Description=KinBot — AI Agent Platform
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=$KINBOT_USER
Group=$KINBOT_USER
WorkingDirectory=$KINBOT_DIR
EnvironmentFile=-${env_file}
ExecStart=$BUN_BIN src/server/index.ts
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=kinbot

[Install]
WantedBy=multi-user.target
UNIT

  systemctl daemon-reload
  systemctl enable kinbot
  systemctl start kinbot
  success "systemd system service started"
}

# ─── Service: systemd user (non-root) ────────────────────────────────────────
create_systemd_user_service() {
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  UNIT_DIR="$HOME/.config/systemd/user"
  UNIT_FILE="$UNIT_DIR/kinbot.service"

  mkdir -p "$UNIT_DIR"

  if [ "$IS_UPDATE" = true ] && systemctl --user is-active --quiet kinbot 2>/dev/null; then
    info "Stopping existing service..."
    systemctl --user stop kinbot
  fi

  cat > "$UNIT_FILE" << UNIT
[Unit]
Description=KinBot — AI Agent Platform
After=network.target

[Service]
Type=simple
WorkingDirectory=$KINBOT_DIR
EnvironmentFile=-${env_file}
ExecStart=$BUN_BIN src/server/index.ts
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
UNIT

  systemctl --user daemon-reload
  systemctl --user enable kinbot
  systemctl --user start kinbot

  loginctl enable-linger "$USER" 2>/dev/null || \
    warn "Could not enable lingering (service won't auto-start on boot without login). Run: sudo loginctl enable-linger $USER"

  success "systemd user service started"
}

# ─── Service: launchd (macOS) ────────────────────────────────────────────────
create_launchd_service() {
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  PLIST_DIR="$HOME/Library/LaunchAgents"
  PLIST_PATH="$PLIST_DIR/io.kinbot.server.plist"
  LOG_DIR="$HOME/Library/Logs/kinbot"

  mkdir -p "$PLIST_DIR" "$LOG_DIR"

  if [ -f "$PLIST_PATH" ]; then
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
  fi

  # Build env dict from kinbot.env for launchd (it doesn't support EnvironmentFile)
  local env_dict=""
  if [ -f "$env_file" ]; then
    while IFS='=' read -r key value; do
      # Skip comments and empty lines
      [[ "$key" =~ ^#.*$ ]] && continue
      [[ -z "$key" ]] && continue
      env_dict+="    <key>${key}</key><string>${value}</string>\n"
    done < "$env_file"
  fi

  cat > "$PLIST_PATH" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>io.kinbot.server</string>

  <key>ProgramArguments</key>
  <array>
    <string>$BUN_BIN</string>
    <string>src/server/index.ts</string>
  </array>

  <key>WorkingDirectory</key>
  <string>$KINBOT_DIR</string>

  <key>EnvironmentVariables</key>
  <dict>
$(printf '%b' "$env_dict")    <key>PATH</key><string>$(dirname "$BUN_BIN"):/usr/local/bin:/usr/bin:/bin</string>
  </dict>

  <key>RunAtLoad</key>
  <true/>

  <key>KeepAlive</key>
  <true/>

  <key>StandardOutPath</key>
  <string>$LOG_DIR/kinbot.log</string>

  <key>StandardErrorPath</key>
  <string>$LOG_DIR/kinbot-error.log</string>
</dict>
</plist>
PLIST

  launchctl load "$PLIST_PATH"
  success "launchd service loaded"
}

# ─── Service: start/stop script (WSL / no-systemd fallback) ──────────────────
create_script_service() {
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  local script_path="$KINBOT_DIR/kinbot"
  local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
  local log_file="$KINBOT_DATA_DIR/kinbot.log"

  cat > "$script_path" << 'SCRIPT_HEADER'
#!/usr/bin/env bash
# KinBot service manager (for systems without systemd)
set -euo pipefail
SCRIPT_HEADER

  cat >> "$script_path" << SCRIPT_VARS
KINBOT_DIR="$KINBOT_DIR"
DATA_DIR="$KINBOT_DATA_DIR"
ENV_FILE="$env_file"
PID_FILE="$pid_file"
LOG_FILE="$log_file"
BUN_BIN="$BUN_BIN"
SCRIPT_VARS

  cat >> "$script_path" << 'SCRIPT_BODY'

# Verify PID file points to an actual KinBot process (not a recycled PID)
is_running() {
  [ -f "$PID_FILE" ] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null)" || return 1
  [ -n "$pid" ] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  # Guard against recycled PIDs: verify the process is actually bun/kinbot
  if [ -d "/proc/$pid" ]; then
    local cmdline
    cmdline="$(cat "/proc/$pid/cmdline" 2>/dev/null | tr '\0' ' ')" || true
    if echo "$cmdline" | grep -qiE 'bun|kinbot'; then
      return 0
    fi
    # PID exists but isn't KinBot — stale PID file
    return 1
  fi
  # No /proc (macOS/BSD) — fall back to ps
  if ps -p "$pid" -o args= 2>/dev/null | grep -qiE 'bun|kinbot'; then
    return 0
  fi
  return 1
}

get_pid() {
  cat "$PID_FILE" 2>/dev/null || echo ""
}

# Rotate log file if it exceeds the threshold
# Keeps up to 3 archived logs: kinbot.log.1 (newest) .. kinbot.log.3 (oldest)
rotate_logs() {
  local max_bytes="${1:-52428800}"  # default 50MB
  local max_archives=3

  [ -f "$LOG_FILE" ] || return 0

  local size_bytes
  size_bytes="$(stat -c %s "$LOG_FILE" 2>/dev/null || stat -f %z "$LOG_FILE" 2>/dev/null || echo 0)"
  [ "$size_bytes" -ge "$max_bytes" ] 2>/dev/null || return 0

  # Shift existing archives: .3 -> deleted, .2 -> .3, .1 -> .2
  local i=$max_archives
  while [ "$i" -gt 1 ]; do
    local prev=$((i - 1))
    [ -f "${LOG_FILE}.${prev}" ] && mv -f "${LOG_FILE}.${prev}" "${LOG_FILE}.${i}"
    i=$((i - 1))
  done

  # Current log becomes .1, start fresh
  mv -f "$LOG_FILE" "${LOG_FILE}.1"
  : > "$LOG_FILE"

  local size_mb=$((size_bytes / 1048576))
  echo "Log rotated (was ${size_mb}MB). Archived to ${LOG_FILE}.1"
}

case "${1:-}" in
  start)
    if is_running; then
      echo "KinBot is already running (PID $(get_pid))"
      exit 0
    fi
    # Clean up stale PID file if present
    rm -f "$PID_FILE"
    # Auto-rotate logs before starting if they're large
    rotate_logs
    echo "Starting KinBot..."
    cd "$KINBOT_DIR"
    set -a
    # shellcheck disable=SC1090
    [ -f "$ENV_FILE" ] && . "$ENV_FILE"
    set +a
    nohup "$BUN_BIN" src/server/index.ts >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "KinBot started (PID $!)"
    echo "Logs: tail -f $LOG_FILE"
    ;;
  stop)
    if ! is_running; then
      echo "KinBot is not running"
      rm -f "$PID_FILE"
      exit 0
    fi
    _pid="$(get_pid)"
    echo "Stopping KinBot (PID $_pid)..."
    kill "$_pid" 2>/dev/null || true

    # Wait up to 10 seconds for graceful shutdown
    _attempts=0
    while [ $_attempts -lt 20 ] && kill -0 "$_pid" 2>/dev/null; do
      sleep 0.5
      _attempts=$((_attempts + 1))
    done

    # Force kill if still running
    if kill -0 "$_pid" 2>/dev/null; then
      echo "Process didn't stop gracefully, sending SIGKILL..."
      kill -9 "$_pid" 2>/dev/null || true
      sleep 1
    fi

    rm -f "$PID_FILE"
    echo "KinBot stopped"
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  status)
    # ── Version ──
    _ver=""
    if [ -d "$KINBOT_DIR/.git" ]; then
      _ver="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    fi

    if is_running; then
      _pid="$(get_pid)"
      echo "● KinBot is running (PID $_pid)"
      [ -n "$_ver" ] && echo "  Version: $_ver"

      # Show uptime
      if [ -d "/proc/$_pid" ]; then
        _start_time="$(stat -c %Y "/proc/$_pid" 2>/dev/null)" || _start_time=""
        if [ -n "$_start_time" ]; then
          _now_time="$(date +%s)"
          _uptime_s=$((_now_time - _start_time))
          _days=$((_uptime_s / 86400))
          _hours=$(( (_uptime_s % 86400) / 3600 ))
          _mins=$(( (_uptime_s % 3600) / 60 ))
          if [ "$_days" -gt 0 ]; then
            echo "  Uptime:  ${_days}d ${_hours}h ${_mins}m"
          elif [ "$_hours" -gt 0 ]; then
            echo "  Uptime:  ${_hours}h ${_mins}m"
          else
            echo "  Uptime:  ${_mins}m"
          fi
        fi
      fi

      # Show memory usage
      _mem_kb=""
      if [ -f "/proc/$_pid/status" ]; then
        _mem_kb="$(awk '/^VmRSS:/ {print $2}' "/proc/$_pid/status" 2>/dev/null)" || _mem_kb=""
      fi
      if [ -z "$_mem_kb" ]; then
        _mem_kb="$(ps -p "$_pid" -o rss= 2>/dev/null | tr -d ' ')" || _mem_kb=""
      fi
      if [ -n "$_mem_kb" ] && [ "$_mem_kb" -gt 0 ] 2>/dev/null; then
        _mem_mb=$((_mem_kb / 1024))
        if [ "$_mem_mb" -gt 512 ] 2>/dev/null; then
          echo "  Memory:  ${_mem_mb}MB RSS ⚠ (high)"
        else
          echo "  Memory:  ${_mem_mb}MB RSS"
        fi
      fi

      # Show port from config and HTTP health
      _port=""
      if [ -f "$ENV_FILE" ]; then
        _port="$(grep '^PORT=' "$ENV_FILE" 2>/dev/null | cut -d= -f2)" || _port=""
      fi
      if [ -n "$_port" ]; then
        _http_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${_port}/" --max-time 3 2>/dev/null || echo "000")"
        if [ "$_http_code" != "000" ]; then
          echo "  Port:    $_port (HTTP $_http_code ✓)"
        else
          echo "  Port:    $_port (not responding ⚠)"
        fi
      fi

      # Show database info
      _db_file="$DATA_DIR/kinbot.db"
      if [ -f "$_db_file" ]; then
        _db_size="$(du -h "$_db_file" 2>/dev/null | awk '{print $1}')" || _db_size=""
        [ -n "$_db_size" ] && echo "  DB:      $_db_size"
      fi

      # Show disk space
      _avail_kb="$(df -k "$DATA_DIR" 2>/dev/null | awk 'NR==2 {print $4}')" || _avail_kb=""
      if [ -n "$_avail_kb" ] && [ "$_avail_kb" -gt 0 ] 2>/dev/null; then
        _avail_mb=$((_avail_kb / 1024))
        _avail_gb=$((_avail_mb / 1024))
        if [ "$_avail_mb" -lt 500 ] 2>/dev/null; then
          echo "  Disk:    ${_avail_mb}MB free ⚠ (low)"
        elif [ "$_avail_gb" -gt 0 ] 2>/dev/null; then
          echo "  Disk:    ${_avail_gb}GB free"
        else
          echo "  Disk:    ${_avail_mb}MB free"
        fi
      fi

      # Show log file size
      if [ -f "$LOG_FILE" ]; then
        _log_size="$(du -h "$LOG_FILE" 2>/dev/null | awk '{print $1}')" || _log_size=""
        [ -n "$_log_size" ] && echo "  Logs:    $LOG_FILE ($_log_size)"
        _log_kb="$(du -k "$LOG_FILE" 2>/dev/null | awk '{print $1}')" || _log_kb="0"
        if [ "$_log_kb" -gt 102400 ] 2>/dev/null; then
          echo "  ⚠ Log file is large. Run: $0 log-rotate"
        fi
      fi

      # Check for available updates (quick, non-blocking)
      if [ -d "$KINBOT_DIR/.git" ]; then
        _branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "main")"
        if git -C "$KINBOT_DIR" fetch --dry-run origin "$_branch" 2>&1 | grep -q "$_branch" 2>/dev/null; then
          _behind="$(git -C "$KINBOT_DIR" rev-list HEAD.."origin/$_branch" --count 2>/dev/null || echo "0")"
          if [ "$_behind" -gt 0 ] 2>/dev/null; then
            _remote_ver="$(git -C "$KINBOT_DIR" describe --tags "origin/$_branch" 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short "origin/$_branch" 2>/dev/null || echo "?")"
            echo ""
            echo "  ⬆ Update available: $_ver → $_remote_ver ($_behind commits behind)"
            echo "    Run: $0 update"
          fi
        fi
      fi
    else
      echo "○ KinBot is not running"
      [ -n "$_ver" ] && echo "  Version: $_ver"
      rm -f "$PID_FILE"
      # Show last few log lines as a hint
      if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "Last log lines:"
        tail -5 "$LOG_FILE" 2>/dev/null | sed 's/^/  /'
      fi
      exit 1
    fi
    ;;
  logs)
    if [ "${2:-}" = "--recent" ] || [ "${2:-}" = "-n" ]; then
      _n="${3:-50}"
      tail -n "$_n" "$LOG_FILE"
    else
      tail -f "$LOG_FILE"
    fi
    ;;
  version)
    if [ -d "$KINBOT_DIR/.git" ]; then
      _ver="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
      echo "KinBot $_ver"
    else
      echo "KinBot (version unknown)"
    fi
    ;;
  log-rotate)
    if [ -f "$LOG_FILE" ]; then
      _size="$(du -h "$LOG_FILE" 2>/dev/null | awk '{print $1}')" || _size="?"
      echo "Current log: $LOG_FILE ($_size)"
      rotate_logs 0  # force rotation regardless of size
      echo "Done."
    else
      echo "No log file found at $LOG_FILE"
    fi
    ;;
  update)
    # Convenience wrapper: re-run the installer in update mode
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      echo "Download and run manually:"
      echo "  curl -fsSL https://raw.githubusercontent.com/MarlBurroW/kinbot/main/install.sh | bash"
      exit 1
    fi
    exec bash "$_install_sh" --update "$@"
    ;;
  backup)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --backup "${2:-}"
    ;;
  doctor)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --doctor
    ;;
  test)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --test
    ;;
  config)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --config
    ;;
  env)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    # Pass remaining args (KEY=VAL, KEY-, or nothing for list)
    exec bash "$_install_sh" --env "${2:-}"
    ;;
  restore)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --restore "${2:-}"
    ;;
  reset)
    _install_sh="$KINBOT_DIR/install.sh"
    if [ ! -f "$_install_sh" ]; then
      echo "install.sh not found at $_install_sh"
      exit 1
    fi
    exec bash "$_install_sh" --reset
    ;;
  *)
    echo "KinBot service manager"
    echo ""
    echo "Usage: $0 <command> [args]"
    echo ""
    echo "Service:"
    echo "  start         Start KinBot in the background"
    echo "  stop          Stop KinBot (graceful, then force after 10s)"
    echo "  restart       Stop and start KinBot"
    echo "  status        Show KinBot status, uptime, and resource usage"
    echo "  logs          Tail the log file (use 'logs -n 50' for recent lines)"
    echo "  log-rotate    Rotate the log file now (archives to .1/.2/.3)"
    echo ""
    echo "Configuration:"
    echo "  config        Re-run the configuration wizard (change port, URL)"
    echo "  env [K=V|K-]  Show, set, or remove config variables"
    echo ""
    echo "Maintenance:"
    echo "  update        Check for updates and apply"
    echo "  backup [path] Back up the database"
    echo "  restore [path] Restore database from a backup"
    echo "  reset         Fix broken install: re-clone & rebuild, keep data"
    echo "  doctor        Generate a diagnostic report (for bug reports)"
    echo "  test          Run self-tests to validate the installation"
    echo "  version       Show installed version"
    exit 1
    ;;
esac
SCRIPT_BODY

  chmod +x "$script_path"

  # Start KinBot
  "$script_path" start
  success "KinBot started via $script_path"
}

# ─── Create service (dispatch) ───────────────────────────────────────────────
create_service() {
  step "Creating service"

  if [ "$INIT_SYSTEM" = "launchd" ]; then
    create_launchd_service
  elif [ "$INIT_SYSTEM" = "script" ]; then
    create_script_service
  elif [ "$IS_ROOT" = true ]; then
    create_systemd_system_service
  else
    create_systemd_user_service
  fi
}

# ─── Post-start health check ─────────────────────────────────────────────────
KINBOT_HEALTHY=false

# Analyze recent logs and provide actionable hints for common failures
diagnose_startup_failure() {
  local log_lines=""

  # Grab last 50 lines of logs depending on init system
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local log_file="$HOME/Library/Logs/kinbot/kinbot.log"
    [ -f "$log_file" ] && log_lines="$(tail -50 "$log_file" 2>/dev/null)"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local log_file="$KINBOT_DATA_DIR/kinbot.log"
    [ -f "$log_file" ] && log_lines="$(tail -50 "$log_file" 2>/dev/null)"
  elif [ "$IS_ROOT" = true ]; then
    log_lines="$(journalctl -u kinbot --no-pager -n 50 2>/dev/null)"
  else
    log_lines="$(journalctl --user -u kinbot --no-pager -n 50 2>/dev/null)"
  fi

  if [ -z "$log_lines" ]; then
    warn "No logs found. The service may not have started at all."
    echo ""
    echo -e "  ${BOLD}Check that the service is registered:${NC}"
    if [ "$INIT_SYSTEM" = "launchd" ]; then
      echo -e "  ${DIM}  launchctl list | grep kinbot${NC}"
    elif [ "$INIT_SYSTEM" = "script" ]; then
      echo -e "  ${DIM}  $KINBOT_DIR/kinbot status${NC}"
    elif [ "$IS_ROOT" = true ]; then
      echo -e "  ${DIM}  sudo systemctl status kinbot${NC}"
    else
      echo -e "  ${DIM}  systemctl --user status kinbot${NC}"
    fi
    return
  fi

  local hints_shown=0

  # Pattern: port already in use
  if echo "$log_lines" | grep -qi 'EADDRINUSE\|address already in use\|port.*already.*in.*use'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} Port $KINBOT_PORT is already in use by another process."
    echo -e "  ${BOLD}Fix:${NC}"
    echo -e "  ${DIM}  # Find what's using the port:${NC}"
    if command -v ss &>/dev/null; then
      echo -e "  ${DIM}  ss -tlnp | grep :${KINBOT_PORT}${NC}"
    elif command -v lsof &>/dev/null; then
      echo -e "  ${DIM}  lsof -i :${KINBOT_PORT}${NC}"
    fi
    echo -e "  ${DIM}  # Then either stop that process, or change KinBot's port:${NC}"
    echo -e "  ${DIM}  bash install.sh --config${NC}"
    hints_shown=$((hints_shown + 1))
  fi

  # Pattern: out of memory
  if echo "$log_lines" | grep -qi 'out of memory\|OOM\|Cannot allocate memory\|JavaScript heap\|ENOMEM'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} KinBot ran out of memory."
    echo -e "  ${BOLD}Fix:${NC}"
    echo -e "  ${DIM}  # Check available memory:${NC}"
    echo -e "  ${DIM}  free -h${NC}"
    echo -e "  ${DIM}  # Add swap if needed:${NC}"
    echo -e "  ${DIM}  sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile${NC}"
    hints_shown=$((hints_shown + 1))
  fi

  # Pattern: permission denied
  if echo "$log_lines" | grep -qi 'EACCES\|permission denied\|EPERM'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} Permission error accessing files or ports."
    echo -e "  ${BOLD}Fix:${NC}"
    if [ "$IS_ROOT" = true ]; then
      echo -e "  ${DIM}  # Re-apply ownership:${NC}"
      echo -e "  ${DIM}  sudo chown -R ${KINBOT_USER}:${KINBOT_USER} ${KINBOT_DIR} ${KINBOT_DATA_DIR}${NC}"
    else
      echo -e "  ${DIM}  # Check file ownership:${NC}"
      echo -e "  ${DIM}  ls -la ${KINBOT_DIR}/ ${KINBOT_DATA_DIR}/${NC}"
    fi
    if [ "$KINBOT_PORT" -lt 1024 ] 2>/dev/null; then
      echo -e "  ${DIM}  # Port $KINBOT_PORT requires root. Use a port >= 1024 or run as root.${NC}"
    fi
    hints_shown=$((hints_shown + 1))
  fi

  # Pattern: database locked / corrupt
  if echo "$log_lines" | grep -qi 'database.*locked\|SQLITE_BUSY\|database.*corrupt\|database disk image is malformed'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} Database issue (locked or corrupted)."
    echo -e "  ${BOLD}Fix:${NC}"
    echo -e "  ${DIM}  # If locked, make sure no other KinBot process is running:${NC}"
    echo -e "  ${DIM}  pgrep -f 'kinbot.*server' && echo 'Found stale process!'${NC}"
    echo -e "  ${DIM}  # If corrupted, restore from a backup:${NC}"
    echo -e "  ${DIM}  bash install.sh --restore${NC}"
    hints_shown=$((hints_shown + 1))
  fi

  # Pattern: missing module / build issue
  if echo "$log_lines" | grep -qi 'Cannot find module\|MODULE_NOT_FOUND\|Cannot find package\|SyntaxError'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} Missing dependency or broken build."
    echo -e "  ${BOLD}Fix:${NC}"
    echo -e "  ${DIM}  bash install.sh --reset${NC}"
    hints_shown=$((hints_shown + 1))
  fi

  # Pattern: env var / config issue
  if echo "$log_lines" | grep -qi 'missing.*env\|missing.*config\|required.*variable\|ENCRYPTION_KEY'; then
    echo ""
    echo -e "  ${RED}Diagnosis:${NC} Missing or invalid configuration."
    echo -e "  ${BOLD}Fix:${NC}"
    echo -e "  ${DIM}  bash install.sh --config${NC}"
    hints_shown=$((hints_shown + 1))
  fi

  # If no specific pattern matched, show the last few log lines as a hint
  if [ "$hints_shown" -eq 0 ]; then
    echo ""
    echo -e "  ${BOLD}Recent log output:${NC}"
    echo "$log_lines" | tail -10 | while IFS= read -r line; do
      echo -e "  ${DIM}  $line${NC}"
    done
    echo ""
    echo -e "  ${DIM}If the issue isn't clear, run: bash install.sh --test${NC}"
    echo -e "  ${DIM}Or open an issue: https://github.com/$KINBOT_REPO/issues${NC}"
  fi
}

verify_running() {
  step "Verifying KinBot is running"

  local url="http://localhost:${KINBOT_PORT}"
  local attempts=0
  local max_attempts=15

  # In quiet mode, reduce wait time
  [ "$KINBOT_QUIET" = true ] && max_attempts=10

  while [ $attempts -lt $max_attempts ]; do
    local http_code
    http_code="$(curl -s -o /dev/null -w '%{http_code}' "${url}/" --max-time 2 2>/dev/null || echo "000")"
    if [ "$http_code" != "000" ]; then
      KINBOT_HEALTHY=true
      success "KinBot is up and responding (HTTP $http_code)"
      return
    fi
    sleep 2
    attempts=$((attempts + 1))
  done

  warn "KinBot hasn't responded after 30 seconds"

  # Try to diagnose the actual problem instead of just saying "check the logs"
  diagnose_startup_failure

  # Always show the log command as a fallback
  echo ""
  echo -e "  ${BOLD}Full logs:${NC}"
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    echo -e "  ${DIM}  tail -f ~/Library/Logs/kinbot/kinbot.log${NC}"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    echo -e "  ${DIM}  $KINBOT_DIR/kinbot logs${NC}"
  elif [ "$IS_ROOT" = true ]; then
    echo -e "  ${DIM}  sudo journalctl -u kinbot -f${NC}"
  else
    echo -e "  ${DIM}  journalctl --user -u kinbot -f${NC}"
  fi
}

# ─── Summary ─────────────────────────────────────────────────────────────────
print_summary() {
  ACTION="installed"
  [ "${IS_UPDATE:-false}" = true ] && ACTION="updated"

  local version
  version="$(get_installed_version)"

  local elapsed=""
  elapsed="$(format_elapsed)"

  # In quiet mode, just print the essential one-liner
  if [ "$KINBOT_QUIET" = true ]; then
    local status_icon="●"
    [ "$KINBOT_HEALTHY" = true ] && status_icon="${GREEN}●${NC}" || status_icon="${YELLOW}●${NC}"
    local quiet_extra=""
    [ -n "$elapsed" ] && quiet_extra=" in ${elapsed}"
    echo -e "${status_icon} KinBot ${version} ${ACTION}${quiet_extra} — ${KINBOT_PUBLIC_URL}"
    return
  fi

  echo ""
  local msg="KinBot ${version} ${ACTION} successfully!"
  local pad_len=$(( 40 - ${#msg} ))
  local padding=""
  for (( i=0; i<pad_len; i++ )); do padding+=" "; done
  echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║  ${msg}${padding}║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Access URL:${NC}   $KINBOT_PUBLIC_URL"
  echo -e "  ${CYAN}Install dir:${NC}  $KINBOT_DIR"
  echo -e "  ${CYAN}Data dir:${NC}     $KINBOT_DATA_DIR"
  echo -e "  ${CYAN}Config file:${NC}  $KINBOT_DATA_DIR/kinbot.env"
  if [ -n "${BACKUP_DB_PATH:-}" ] && [ -f "${BACKUP_DB_PATH:-}" ]; then
    echo -e "  ${CYAN}DB backup:${NC}    $(basename "$BACKUP_DB_PATH")"
  fi
  if [ "$KINBOT_HEALTHY" = true ]; then
    echo -e "  ${GREEN}●${NC} ${BOLD}Status:${NC}       Running"
  else
    echo -e "  ${YELLOW}●${NC} ${BOLD}Status:${NC}       Starting (check logs if it doesn't come up)"
  fi
  if [ -n "$elapsed" ]; then
    echo -e "  ${CYAN}Completed in:${NC} $elapsed"
  fi
  echo ""

  if [ "${IS_UPDATE:-false}" != true ]; then
    echo -e "  ${BOLD}Getting started:${NC}"
    echo -e "  1. Open ${CYAN}$KINBOT_PUBLIC_URL${NC} in your browser"
    echo -e "  2. Create your admin account"
    echo -e "  3. Add an AI provider (Anthropic, OpenAI, or Google Gemini)"
    echo -e "  4. Create your first agent and start chatting!"
    echo ""
    echo -e "  ${DIM}You'll need at least one AI provider API key.${NC}"
  else
    echo -e "  Visit ${CYAN}$KINBOT_PUBLIC_URL${NC} to continue using KinBot."
  fi
  echo ""

  # Security hints for non-localhost HTTP URLs
  local show_security_hints=false
  local url_is_http=false
  local url_is_remote=false

  if [[ "$KINBOT_PUBLIC_URL" =~ ^http:// ]]; then
    url_is_http=true
  fi
  # Check if URL points to a non-localhost address
  local url_host
  url_host="$(echo "$KINBOT_PUBLIC_URL" | sed -E 's|^https?://||; s|[:/].*||')"
  case "$url_host" in
    localhost|127.0.0.1|::1) ;;
    *) url_is_remote=true ;;
  esac

  if [ "$url_is_http" = true ] && [ "$url_is_remote" = true ]; then
    show_security_hints=true
  fi

  # Check if ENCRYPTION_KEY is missing from config
  local has_encryption_key=false
  local env_file_path="$KINBOT_DATA_DIR/kinbot.env"
  if [ -f "$env_file_path" ] && grep -q '^ENCRYPTION_KEY=.\+' "$env_file_path" 2>/dev/null; then
    has_encryption_key=true
  fi

  if [ "$show_security_hints" = true ] || [ "$has_encryption_key" = false ]; then
    echo -e "  ${YELLOW}${BOLD}⚡ Secure your installation:${NC}"
    echo ""

    if [ "$show_security_hints" = true ]; then
      echo -e "  ${YELLOW}▸${NC} Your public URL uses ${BOLD}HTTP${NC} on a non-localhost address."
      echo -e "    API keys and credentials will be sent in plain text!"
      echo -e "    Set up HTTPS with a reverse proxy:"
      echo ""
      echo -e "    ${BOLD}Caddy${NC} ${DIM}(easiest, auto-HTTPS with Let's Encrypt):${NC}"
      echo -e "    ${DIM}    # Install: https://caddyserver.com/docs/install${NC}"
      echo -e "    ${DIM}    # Caddyfile:${NC}"
      echo -e "    ${DIM}    your-domain.com {${NC}"
      echo -e "    ${DIM}        reverse_proxy localhost:${KINBOT_PORT}${NC}"
      echo -e "    ${DIM}    }${NC}"
      echo ""
      echo -e "    ${BOLD}Nginx${NC}${DIM} + certbot, ${BOLD}Traefik${NC}${DIM}, or any reverse proxy also work.${NC}"
      echo -e "    ${DIM}Then update your URL: bash install.sh --env PUBLIC_URL=https://your-domain.com${NC}"
      echo ""
    fi

    if [ "$has_encryption_key" = false ]; then
      echo -e "  ${YELLOW}▸${NC} Set an ${BOLD}encryption key${NC} to protect stored API keys at rest:"
      echo -e "    ${DIM}bash install.sh --env ENCRYPTION_KEY=\$(openssl rand -hex 32)${NC}"
      echo ""
    fi
  fi

  if [ "$INIT_SYSTEM" = "script" ]; then
    echo -e "  ${BOLD}Service commands:${NC}"
    echo -e "    $KINBOT_DIR/kinbot status"
    echo -e "    $KINBOT_DIR/kinbot restart"
    echo -e "    $KINBOT_DIR/kinbot logs"
    if [ "$IS_WSL" = true ]; then
      echo ""
      echo -e "  ${YELLOW}Note:${NC} On WSL, KinBot won't auto-start on boot."
      echo -e "  Add to your ~/.bashrc or ~/.profile:"
      echo -e "    ${DIM}$KINBOT_DIR/kinbot start${NC}"
    fi
  elif [ "$INIT_SYSTEM" = "systemd" ]; then
    if [ "$IS_ROOT" = true ]; then
      echo -e "  ${BOLD}Service commands:${NC}"
      echo -e "    sudo systemctl status kinbot"
      echo -e "    sudo systemctl restart kinbot"
      echo -e "    sudo journalctl -u kinbot -f"
    else
      echo -e "  ${BOLD}Service commands:${NC}"
      echo -e "    systemctl --user status kinbot"
      echo -e "    systemctl --user restart kinbot"
      echo -e "    journalctl --user -u kinbot -f"
    fi
  else
    echo -e "  ${BOLD}Service commands:${NC}"
    echo -e "    launchctl list | grep kinbot"
    echo -e "    tail -f ~/Library/Logs/kinbot/kinbot.log"
    echo -e "    launchctl unload ~/Library/LaunchAgents/io.kinbot.server.plist"
  fi

  echo ""
  echo -e "  ${DIM}To change settings: edit $KINBOT_DATA_DIR/kinbot.env"
  if [ "$INIT_SYSTEM" = "systemd" ]; then
    local restart_cmd="systemctl --user restart kinbot"
    [ "$IS_ROOT" = true ] && restart_cmd="sudo systemctl restart kinbot"
    echo -e "  then run: $restart_cmd${NC}"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    echo -e "  then run: $KINBOT_DIR/kinbot restart${NC}"
  fi
  echo ""
}

# ─── Uninstall ───────────────────────────────────────────────────────────────
uninstall() {
  echo ""
  echo -e "${BOLD}KinBot Uninstaller${NC}"
  echo ""

  detect_os

  # Stop and disable service
  header "Stopping service..."
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    if [ -f "$plist" ]; then
      launchctl unload "$plist" 2>/dev/null || true
      rm -f "$plist"
      success "launchd service removed"
    else
      info "No launchd service found"
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    if [ -x "$script_path" ]; then
      "$script_path" stop 2>/dev/null || true
      success "KinBot stopped"
    else
      # Try killing by PID file
      local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
      if [ -f "$pid_file" ]; then
        kill "$(cat "$pid_file")" 2>/dev/null || true
        rm -f "$pid_file"
      fi
      info "No service script found"
    fi
  elif [ "$IS_ROOT" = true ]; then
    if systemctl is-active --quiet kinbot 2>/dev/null; then
      systemctl stop kinbot
    fi
    systemctl disable kinbot 2>/dev/null || true
    rm -f /etc/systemd/system/kinbot.service
    systemctl daemon-reload
    success "systemd system service removed"
  else
    if systemctl --user is-active --quiet kinbot 2>/dev/null; then
      systemctl --user stop kinbot
    fi
    systemctl --user disable kinbot 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/kinbot.service"
    systemctl --user daemon-reload
    success "systemd user service removed"
  fi

  # Remove app directory
  header "Removing application files..."
  if [ -d "$KINBOT_DIR" ]; then
    rm -rf "$KINBOT_DIR"
    success "Removed $KINBOT_DIR"
  else
    info "$KINBOT_DIR not found — skipping"
  fi

  # Remove system user (root only)
  if [ "$IS_ROOT" = true ] && id "${KINBOT_USER:-kinbot}" &>/dev/null; then
    userdel "${KINBOT_USER:-kinbot}" 2>/dev/null || true
    success "System user '${KINBOT_USER:-kinbot}' removed"
  fi

  # Ask about data directory
  echo ""
  local remove_data="n"
  if [ "${KINBOT_NO_PROMPT:-}" = "true" ] || [ "${CI:-}" = "true" ]; then
    remove_data="n"
  elif [ -d "$KINBOT_DATA_DIR" ]; then
    # Show what's in the data directory before asking
    local data_size
    data_size="$(du -sh "$KINBOT_DATA_DIR" 2>/dev/null | awk '{print $1}' || echo "unknown")"
    local has_db=false
    [ -f "$KINBOT_DATA_DIR/kinbot.db" ] && has_db=true

    echo -e "  ${DIM}Data directory: $KINBOT_DATA_DIR ($data_size)${NC}"
    if [ "$has_db" = true ]; then
      local db_size
      db_size="$(du -h "$KINBOT_DATA_DIR/kinbot.db" 2>/dev/null | awk '{print $1}' || echo "?")"
      echo -e "  ${DIM}  Database: $db_size${NC}"
    fi
    [ -f "$KINBOT_DATA_DIR/kinbot.env" ] && echo -e "  ${DIM}  Config: kinbot.env${NC}"
    local backup_count=0
    if [ -d "$KINBOT_DATA_DIR/backups" ]; then
      backup_count="$(find "$KINBOT_DATA_DIR/backups" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
      [ "$backup_count" -gt 0 ] && echo -e "  ${DIM}  Backups: $backup_count${NC}"
    fi
    echo ""

    echo -en "  ${YELLOW}?${NC} ${BOLD}Remove data directory?${NC} ${DIM}This deletes your database and config [y/N]${NC}: " >/dev/tty
    read -r remove_data </dev/tty || remove_data="n"

    # If user wants to delete data and a database exists, offer a backup first
    if [[ "$remove_data" =~ ^[Yy]$ ]] && [ "$has_db" = true ]; then
      echo ""
      local do_backup="y"
      echo -en "  ${CYAN}?${NC} ${BOLD}Create a backup before deleting?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
      read -r do_backup </dev/tty || do_backup="y"
      [ -z "$do_backup" ] && do_backup="y"

      if [[ "$do_backup" =~ ^[Yy]$ ]]; then
        local backup_dest
        backup_dest="$HOME/kinbot-backup-$(date +%Y%m%d-%H%M%S).db"
        if cp "$KINBOT_DATA_DIR/kinbot.db" "$backup_dest" 2>/dev/null; then
          # Also copy the config alongside the DB
          if [ -f "$KINBOT_DATA_DIR/kinbot.env" ]; then
            cp "$KINBOT_DATA_DIR/kinbot.env" "${backup_dest%.db}.env" 2>/dev/null || true
          fi
          success "Backup saved to $backup_dest"
        else
          warn "Could not create backup. Aborting data removal for safety."
          remove_data="n"
        fi
      fi
    fi
  else
    info "$KINBOT_DATA_DIR not found — nothing to remove"
  fi

  if [[ "$remove_data" =~ ^[Yy]$ ]]; then
    if [ -d "$KINBOT_DATA_DIR" ]; then
      rm -rf "$KINBOT_DATA_DIR"
      success "Removed $KINBOT_DATA_DIR"
    fi
  elif [ -d "$KINBOT_DATA_DIR" ]; then
    info "Data kept at $KINBOT_DATA_DIR"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}KinBot uninstalled.${NC}"
  echo ""
}

# ─── Version info ─────────────────────────────────────────────────────────────
# ─── Categorized commit display ──────────────────────────────────────────────
# Displays commits grouped by conventional commit type (feat, fix, etc.)
# Usage: show_categorized_commits "commit_range" [max_per_category]
# Example: show_categorized_commits "HEAD..origin/main" 10
show_categorized_commits() {
  local range="$1"
  local max_per_cat="${2:-0}"  # 0 = no limit

  local commits
  commits="$(git -C "$KINBOT_DIR" log --oneline "$range" 2>/dev/null)"
  [ -z "$commits" ] && return 1

  # Extract categories
  local feats fixes installer docs refactor other
  feats="$(echo "$commits" | grep -iE '^\w+ feat' || true)"
  fixes="$(echo "$commits" | grep -iE '^\w+ fix' || true)"
  installer="$(echo "$commits" | grep -iE '^\w+ installer' || true)"
  docs="$(echo "$commits" | grep -iE '^\w+ (docs?|readme)' || true)"
  refactor="$(echo "$commits" | grep -iE '^\w+ (refactor|chore|ci|build|perf|test)' || true)"
  other="$(echo "$commits" | grep -viE '^\w+ (feat|fix|installer|docs?|readme|refactor|chore|ci|build|perf|test)' || true)"

  _show_cat_section() {
    local title="$1" icon="$2" lines="$3"
    [ -z "$lines" ] && return
    local count shown=0
    count="$(echo "$lines" | wc -l)"
    echo -e "  ${icon} ${BOLD}${title}${NC} ${DIM}(${count})${NC}"
    while IFS= read -r line; do
      if [ "$max_per_cat" -gt 0 ] 2>/dev/null && [ "$shown" -ge "$max_per_cat" ] 2>/dev/null; then
        local remaining=$((count - max_per_cat))
        echo -e "    ${DIM}  ... and $remaining more${NC}"
        break
      fi
      local hash="${line%% *}"
      local msg="${line#"$hash" }"
      echo -e "    ${DIM}•${NC} $msg"
      shown=$((shown + 1))
    done <<< "$lines"
    echo ""
  }

  _show_cat_section "Features" "✨" "$feats"
  _show_cat_section "Bug Fixes" "🐛" "$fixes"
  _show_cat_section "Installer" "📦" "$installer"
  _show_cat_section "Documentation" "📝" "$docs"
  _show_cat_section "Maintenance" "🔧" "$refactor"
  _show_cat_section "Other" "📋" "$other"

  return 0
}

get_installed_version() {
  if [ -d "$KINBOT_DIR/.git" ]; then
    git -C "$KINBOT_DIR" describe --tags 2>/dev/null || \
      git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || \
      echo "unknown"
  else
    echo "not installed"
  fi
}

get_installed_branch() {
  if [ -d "$KINBOT_DIR/.git" ]; then
    git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "unknown"
  else
    echo "n/a"
  fi
}

get_installed_date() {
  if [ -d "$KINBOT_DIR/.git" ]; then
    git -C "$KINBOT_DIR" log -1 --format='%ci' 2>/dev/null | cut -d' ' -f1 || echo "unknown"
  else
    echo "n/a"
  fi
}

show_version() {
  # Detect OS first for correct default dirs
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
  fi

  local version
  version="$(get_installed_version)"

  if [ "$version" = "not installed" ]; then
    echo "KinBot is not installed at $KINBOT_DIR"
    exit 1
  fi

  local branch date_str commit_count
  branch="$(get_installed_branch)"
  date_str="$(get_installed_date)"
  commit_count="$(git -C "$KINBOT_DIR" rev-list HEAD --count 2>/dev/null || echo "?")"

  echo -e "${BOLD}KinBot${NC} $version"
  echo -e "  Branch: $branch"
  echo -e "  Last update: $date_str"
  echo -e "  Commits: $commit_count"
  echo -e "  Install: $KINBOT_DIR"

  # Check if updates are available
  if git -C "$KINBOT_DIR" fetch --dry-run origin "$branch" 2>&1 | grep -q "$branch"; then
    local remote_version
    remote_version="$(git -C "$KINBOT_DIR" describe --tags "origin/$branch" 2>/dev/null || \
      git -C "$KINBOT_DIR" rev-parse --short "origin/$branch" 2>/dev/null || echo "unknown")"
    local behind
    behind="$(git -C "$KINBOT_DIR" rev-list HEAD.."origin/$branch" --count 2>/dev/null || echo "0")"
    if [ "$behind" -gt 0 ] 2>/dev/null; then
      echo ""
      echo -e "  ${YELLOW}⚠ $behind commit(s) behind${NC} → $remote_version"
      echo -e "  ${DIM}Run install.sh to update${NC}"
    else
      echo ""
      echo -e "  ${GREEN}✓ Up to date${NC}"
    fi
  fi
}

# ─── Changelog ────────────────────────────────────────────────────────────────
show_changelog() {
  # Detect OS first for correct default dirs
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
  fi

  if [ ! -d "$KINBOT_DIR/.git" ]; then
    echo "KinBot is not installed at $KINBOT_DIR"
    exit 1
  fi

  local branch
  branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "main")"

  # Fetch latest from remote
  info "Fetching latest changes..."
  if ! git -C "$KINBOT_DIR" fetch origin "$branch" --quiet 2>/dev/null; then
    error "Could not fetch from remote. Check your internet connection."
  fi

  local local_ref remote_ref
  local_ref="$(git -C "$KINBOT_DIR" rev-parse HEAD 2>/dev/null)"
  remote_ref="$(git -C "$KINBOT_DIR" rev-parse "origin/$branch" 2>/dev/null)"

  if [ "$local_ref" = "$remote_ref" ]; then
    local version
    version="$(get_installed_version)"
    echo ""
    echo -e "  ${GREEN}✓ Up to date${NC} ($version)"
    echo -e "  ${DIM}No new changes on ${branch}.${NC}"
    echo ""
    exit 0
  fi

  local behind
  behind="$(git -C "$KINBOT_DIR" rev-list HEAD.."origin/$branch" --count 2>/dev/null || echo "0")"
  local current_version new_version
  current_version="$(get_installed_version)"
  new_version="$(git -C "$KINBOT_DIR" describe --tags "origin/$branch" 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short "origin/$branch")"

  echo ""
  echo -e "${BOLD}KinBot Changelog${NC}"
  echo ""
  echo -e "  ${CYAN}Installed:${NC}  $current_version"
  echo -e "  ${CYAN}Latest:${NC}     $new_version"
  echo -e "  ${CYAN}Changes:${NC}    $behind commit(s) on ${branch}"
  echo ""

  # Show categorized changelog
  if ! show_categorized_commits "HEAD..origin/$branch"; then
    echo -e "  ${DIM}No commits to show.${NC}"
    echo ""
    exit 0
  fi

  # Show tags in the range (version milestones)
  local tags_in_range
  tags_in_range="$(git -C "$KINBOT_DIR" tag --sort=-version:refname --contains HEAD --no-contains "origin/$branch" 2>/dev/null || true)"
  # Actually we want tags between HEAD and origin/branch
  tags_in_range="$(git -C "$KINBOT_DIR" log --simplify-by-decoration --decorate=short --pretty=format:'%D' "HEAD..origin/$branch" 2>/dev/null | grep -oE 'tag: [^,)]+' | sed 's/tag: //' || true)"
  if [ -n "$tags_in_range" ]; then
    echo -e "  ${CYAN}${BOLD}Version tags in this range:${NC}"
    echo "$tags_in_range" | while IFS= read -r tag; do
      [ -z "$tag" ] && continue
      local tag_date
      tag_date="$(git -C "$KINBOT_DIR" log -1 --format='%ci' "$tag" 2>/dev/null | cut -d' ' -f1 || echo "")"
      echo -e "    ${BOLD}$tag${NC} ${DIM}($tag_date)${NC}"
    done
    echo ""
  fi

  echo -e "  ${DIM}To apply these changes: bash install.sh --update${NC}"
  echo ""
}

# ─── Help ────────────────────────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}KinBot Installer${NC} — Self-hosted AI agent platform"
  echo ""
  echo -e "${BOLD}USAGE${NC}"
  echo "  curl -fsSL https://kinbot.sh | bash          # Fresh install"
  echo "  bash install.sh [COMMAND] [OPTIONS]           # Local install or manage"
  echo ""

  echo -e "${BOLD}INSTALL & UPDATE${NC}"
  echo "  ${DIM}(no command)${NC}      Install KinBot (or update if already installed)"
  echo "  --update        Check for updates and apply if available"
  echo "  --docker        Docker Compose setup (no Bun/build needed)"
  echo "  --dry-run       Preview what would happen without making changes"
  echo "  --reset         Fix broken install: re-clone & rebuild, keep data"
  echo "  --uninstall     Remove KinBot (keeps data unless confirmed)"
  echo ""

  echo -e "${BOLD}SERVICE${NC}"
  echo "  --start         Start the KinBot service"
  echo "  --stop          Stop the KinBot service"
  echo "  --restart       Restart the KinBot service"
  echo "  --logs [N]      Show logs (follow live, or last N lines)"
  echo "                  --grep PATTERN: filter lines; --since TIME: journalctl time"
  echo ""

  echo -e "${BOLD}CONFIGURATION${NC}"
  echo "  --config        Re-run the configuration wizard (change port, URL)"
  echo "  --env [KEY=VAL] Show, set, or remove env variables in the config file"
  echo "                  No args: show all; KEY=VAL: set; KEY-: remove"
  echo ""

  echo -e "${BOLD}DATA${NC}"
  echo "  --backup [path] Back up database (and config) to a file"
  echo "  --restore [path] Restore from a backup (interactive picker if no path)"
  echo ""

  echo -e "${BOLD}DIAGNOSTICS${NC}"
  echo "  --status        Check current installation health"
  echo "  --test          Run self-tests (validates DB, build, HTTP, etc.)"
  echo "  --doctor        Generate a diagnostic report (for bug reports / support)"
  echo "  --version       Show installed version and check for updates"
  echo "  --changelog     Show what changed between installed and latest version"
  echo ""

  echo -e "${BOLD}SHELL${NC}"
  echo "  --completions [bash|zsh|fish]  Generate shell tab-completions"
  echo ""

  echo -e "${BOLD}FLAGS${NC}"
  echo "  --yes, -y       Auto-confirm all prompts (accept defaults)"
  echo "  --quiet, -q     Suppress non-essential output (only errors + summary)"
  echo "  --no-color      Disable colored output (also: NO_COLOR=1)"
  echo "  --help          Show this help message"
  echo ""

  echo -e "${BOLD}ENVIRONMENT VARIABLES${NC}"
  echo "  KINBOT_PORT         Port to run on (default: 3000)"
  echo "  KINBOT_DIR          Installation directory"
  echo "  KINBOT_DATA_DIR     Data directory (database, config)"
  echo "  KINBOT_PUBLIC_URL   Public URL for webhooks & invite links"
  echo "  KINBOT_BRANCH       Git branch to install (default: main)"
  echo "  KINBOT_NO_PROMPT    Skip interactive prompts (default: false)"
  echo "  KINBOT_YES          Auto-confirm all prompts (same as --yes)"
  echo "  KINBOT_QUIET        Suppress non-essential output (same as --quiet)"
  echo "  KINBOT_SKIP_SELF_UPDATE  Skip installer self-update check"
  echo ""

  echo -e "${BOLD}QUICK START${NC}"
  echo -e "  ${DIM}# Install with defaults${NC}"
  echo "  curl -fsSL https://kinbot.sh | bash"
  echo ""
  echo -e "  ${DIM}# Custom port, non-interactive${NC}"
  echo "  KINBOT_PORT=8080 bash install.sh -y"
  echo ""
  echo -e "  ${DIM}# Docker (no build tools needed)${NC}"
  echo "  bash install.sh --docker"
  echo ""

  echo -e "${BOLD}COMMON TASKS${NC}"
  echo -e "  ${DIM}# Update to latest version${NC}"
  echo "  bash install.sh --update"
  echo ""
  echo -e "  ${DIM}# Auto-update from crontab${NC}"
  echo "  bash install.sh --update -y -q"
  echo ""
  echo -e "  ${DIM}# Change config${NC}"
  echo "  bash install.sh --config"
  echo "  bash install.sh --env LOG_LEVEL=debug"
  echo "  bash install.sh --env ENCRYPTION_KEY=\$(openssl rand -hex 32)"
  echo ""
  echo -e "  ${DIM}# Back up and restore${NC}"
  echo "  bash install.sh --backup ~/kinbot-backup.db"
  echo "  bash install.sh --restore ~/kinbot-backup.db"
  echo ""
  echo -e "  ${DIM}# Troubleshoot${NC}"
  echo "  bash install.sh --status"
  echo "  bash install.sh --logs 200 --grep error"
  echo "  bash install.sh --doctor > report.md"
  echo ""
  echo -e "  ${DIM}# Fix a broken install (keeps your data)${NC}"
  echo "  bash install.sh --reset"
  echo ""
  echo -e "  ${DIM}# Enable tab completion${NC}"
  echo "  eval \"\$(bash install.sh --completions bash)\"   ${DIM}# bash${NC}"
  echo "  eval \"\$(bash install.sh --completions zsh)\"    ${DIM}# zsh${NC}"
  echo "  bash install.sh --completions fish > ~/.config/fish/completions/kinbot.fish"
  echo ""
}

# ─── Status check ────────────────────────────────────────────────────────────
check_status() {
  echo ""
  echo -e "${BOLD}KinBot Status Check${NC}"
  echo ""

  detect_os

  local has_issues=false

  # Check installation directory
  header "Installation"
  if [ -d "$KINBOT_DIR/.git" ]; then
    local version
    version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    local branch
    branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "unknown")"
    success "Installed at $KINBOT_DIR (${branch} @ ${version})"
  else
    error_noexit "KinBot not found at $KINBOT_DIR"
    has_issues=true
  fi

  # Check data directory
  if [ -d "$KINBOT_DATA_DIR" ]; then
    success "Data directory: $KINBOT_DATA_DIR"
    if [ -f "$KINBOT_DATA_DIR/kinbot.env" ]; then
      success "Config file exists"
      # shellcheck disable=SC1090,SC1091
      . "$KINBOT_DATA_DIR/kinbot.env" 2>/dev/null || true
      KINBOT_PORT="${PORT:-$KINBOT_PORT}"
    else
      warn "No config file found at $KINBOT_DATA_DIR/kinbot.env"
      has_issues=true
    fi
    if [ -f "$KINBOT_DATA_DIR/kinbot.db" ]; then
      local db_size
      db_size="$(du -h "$KINBOT_DATA_DIR/kinbot.db" 2>/dev/null | awk '{print $1}')"
      success "Database: $db_size"
    else
      warn "No database found"
      has_issues=true
    fi
    # Show backup info
    local backup_dir="$KINBOT_DATA_DIR/backups"
    if [ -d "$backup_dir" ]; then
      local backup_count
      backup_count="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
      if [ "$backup_count" -gt 0 ] 2>/dev/null; then
        local latest_backup
        latest_backup="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f -printf '%T@ %f\n' 2>/dev/null | sort -rn | head -1 | awk '{print $2}')"
        success "Backups: $backup_count (latest: $latest_backup)"
      fi
    fi
  else
    error_noexit "Data directory not found at $KINBOT_DATA_DIR"
    has_issues=true
  fi

  # Check Bun
  header "Runtime"
  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun &>/dev/null; then
    local bun_ver
    bun_ver="$(bun --version 2>/dev/null || echo "0.0.0")"
    if version_gte "$bun_ver" "$BUN_MIN_VERSION"; then
      success "Bun v${bun_ver}"
    else
      warn "Bun v${bun_ver} is outdated (need v${BUN_MIN_VERSION}+). Run the installer to upgrade."
      has_issues=true
    fi
  else
    warn "Bun not found"
    has_issues=true
  fi

  # Check service
  header "Service"
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    if launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      success "launchd service is loaded"
    else
      warn "launchd service not loaded"
      has_issues=true
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    if [ -x "$script_path" ]; then
      if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
        success "KinBot is running (PID $(cat "$pid_file"), managed by script)"
      else
        warn "KinBot is not running (start with: $script_path start)"
        has_issues=true
      fi
    else
      warn "Service script not found at $script_path"
      has_issues=true
    fi
  elif [ "$IS_ROOT" = true ]; then
    if systemctl is-active --quiet kinbot 2>/dev/null; then
      success "systemd service is running"
    elif systemctl is-enabled --quiet kinbot 2>/dev/null; then
      warn "systemd service is enabled but not running"
      has_issues=true
    else
      warn "systemd system service not found"
      has_issues=true
    fi
  else
    if systemctl --user is-active --quiet kinbot 2>/dev/null; then
      success "systemd user service is running"
    elif systemctl --user is-enabled --quiet kinbot 2>/dev/null; then
      warn "systemd user service is enabled but not running"
      has_issues=true
    else
      warn "systemd user service not found"
      has_issues=true
    fi
  fi

  # Check port
  header "Network"
  if command -v ss &>/dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":${KINBOT_PORT} "; then
      success "Port $KINBOT_PORT is listening"
    else
      warn "Port $KINBOT_PORT is not listening"
      has_issues=true
    fi
  elif command -v lsof &>/dev/null; then
    if lsof -i ":${KINBOT_PORT}" -sTCP:LISTEN &>/dev/null; then
      success "Port $KINBOT_PORT is listening"
    else
      warn "Port $KINBOT_PORT is not listening"
      has_issues=true
    fi
  else
    info "Cannot check port (no ss or lsof)"
  fi

  # HTTP health check
  if command -v curl &>/dev/null; then
    local http_code
    http_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${KINBOT_PORT}/" --max-time 3 2>/dev/null || echo "000")"
    if [ "$http_code" != "000" ]; then
      success "HTTP responding (status $http_code)"
    else
      warn "HTTP not responding on localhost:${KINBOT_PORT}"
      has_issues=true
    fi

    # Check PUBLIC_URL reachability (important for webhooks)
    local public_url="${PUBLIC_URL:-$KINBOT_PUBLIC_URL}"
    if [ -n "$public_url" ] && [ "$public_url" != "http://localhost:${KINBOT_PORT}" ]; then
      # Extract host from URL to check if it's a local/private IP (skip those)
      local url_host
      url_host="$(echo "$public_url" | sed -E 's|^https?://||; s|[:/].*||')"

      local is_local=false
      case "$url_host" in
        localhost|127.*|10.*|192.168.*) is_local=true ;;
        172.*)
          # Check 172.16.0.0/12 range
          local second_octet
          second_octet="$(echo "$url_host" | cut -d. -f2)"
          [ -n "$second_octet" ] && [ "$second_octet" -ge 16 ] 2>/dev/null && [ "$second_octet" -le 31 ] 2>/dev/null && is_local=true
          ;;
      esac

      if [ "$is_local" = false ]; then
        # Public URL with a real hostname, test reachability
        local public_code
        public_code="$(curl -s -o /dev/null -w '%{http_code}' "$public_url" --max-time 8 2>/dev/null || echo "000")"
        if [ "$public_code" != "000" ]; then
          success "Public URL reachable: $public_url (status $public_code)"

          # Check TLS if HTTPS
          if [[ "$public_url" =~ ^https:// ]]; then
            # Verify certificate validity and expiry
            local cert_expiry cert_days_left
            cert_expiry="$(echo | openssl s_client -servername "$url_host" -connect "$url_host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//')"
            if [ -n "$cert_expiry" ]; then
              local expiry_epoch now_epoch
              expiry_epoch="$(date -d "$cert_expiry" +%s 2>/dev/null || date -jf '%b %d %T %Y %Z' "$cert_expiry" +%s 2>/dev/null || echo "")"
              now_epoch="$(date +%s)"
              if [ -n "$expiry_epoch" ]; then
                cert_days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
                if [ "$cert_days_left" -lt 0 ] 2>/dev/null; then
                  warn "TLS certificate EXPIRED ($cert_expiry)"
                  has_issues=true
                elif [ "$cert_days_left" -lt 7 ] 2>/dev/null; then
                  warn "TLS certificate expires in ${cert_days_left} day(s) ($cert_expiry)"
                  has_issues=true
                elif [ "$cert_days_left" -lt 30 ] 2>/dev/null; then
                  warn "TLS certificate expires in ${cert_days_left} days"
                else
                  success "TLS certificate valid (${cert_days_left} days remaining)"
                fi
              fi
            fi
          fi
        else
          warn "Public URL not reachable: $public_url"
          info "Check your reverse proxy, DNS, and firewall settings"
          info "Webhooks from AI providers may not work until this is fixed"
          has_issues=true
        fi
      else
        info "Public URL is local ($public_url), skipping external reachability check"
      fi
    fi
  fi

  # Check process resources (uptime, memory, disk, logs)
  header "Resources"

  # Process uptime & memory (find the KinBot PID)
  local kinbot_pid=""
  if [ "$INIT_SYSTEM" = "script" ]; then
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    [ -f "$pid_file" ] && kinbot_pid="$(cat "$pid_file" 2>/dev/null)"
  elif [ "$INIT_SYSTEM" = "launchd" ]; then
    kinbot_pid="$(pgrep -f 'bun.*server/index' 2>/dev/null | head -1 || echo "")"
  elif [ "$IS_ROOT" = true ]; then
    kinbot_pid="$(systemctl show kinbot -p MainPID --value 2>/dev/null || echo "")"
    [ "$kinbot_pid" = "0" ] && kinbot_pid=""
  else
    kinbot_pid="$(systemctl --user show kinbot -p MainPID --value 2>/dev/null || echo "")"
    [ "$kinbot_pid" = "0" ] && kinbot_pid=""
  fi

  if [ -n "$kinbot_pid" ] && kill -0 "$kinbot_pid" 2>/dev/null; then
    # Uptime
    local proc_uptime=""
    if [ -d "/proc/$kinbot_pid" ]; then
      local start_time_epoch
      start_time_epoch="$(stat -c %Y "/proc/$kinbot_pid" 2>/dev/null)" || start_time_epoch=""
      if [ -n "$start_time_epoch" ]; then
        local now_epoch uptime_s
        now_epoch="$(date +%s)"
        uptime_s=$((now_epoch - start_time_epoch))
        local d=$((uptime_s / 86400)) h=$(( (uptime_s % 86400) / 3600 )) m=$(( (uptime_s % 3600) / 60 ))
        if [ "$d" -gt 0 ]; then
          proc_uptime="${d}d ${h}h ${m}m"
        elif [ "$h" -gt 0 ]; then
          proc_uptime="${h}h ${m}m"
        else
          proc_uptime="${m}m"
        fi
      fi
    elif [ "$OS" = "Darwin" ]; then
      local elapsed
      elapsed="$(ps -p "$kinbot_pid" -o etime= 2>/dev/null | tr -d ' ')" || elapsed=""
      [ -n "$elapsed" ] && proc_uptime="$elapsed"
    fi
    [ -n "$proc_uptime" ] && success "Process uptime: $proc_uptime (PID $kinbot_pid)"

    # Memory RSS
    local mem_kb=""
    if [ -f "/proc/$kinbot_pid/status" ]; then
      mem_kb="$(awk '/^VmRSS:/ {print $2}' "/proc/$kinbot_pid/status" 2>/dev/null)" || mem_kb=""
    fi
    if [ -z "$mem_kb" ]; then
      mem_kb="$(ps -p "$kinbot_pid" -o rss= 2>/dev/null | tr -d ' ')" || mem_kb=""
    fi
    if [ -n "$mem_kb" ] && [ "$mem_kb" -gt 0 ] 2>/dev/null; then
      local mem_mb=$((mem_kb / 1024))
      if [ "$mem_mb" -gt 512 ] 2>/dev/null; then
        warn "Memory: ${mem_mb}MB RSS (high)"
        has_issues=true
      else
        success "Memory: ${mem_mb}MB RSS"
      fi
    fi
  fi

  # Disk space
  local install_parent
  install_parent="$(dirname "$KINBOT_DIR")"
  local avail_kb=""
  avail_kb="$(df -k "$install_parent" 2>/dev/null | awk 'NR==2 {print $4}')" || avail_kb=""
  if [ -n "$avail_kb" ] && [ "$avail_kb" -gt 0 ] 2>/dev/null; then
    local avail_mb=$((avail_kb / 1024))
    local avail_gb=$((avail_mb / 1024))
    if [ "$avail_mb" -lt 500 ] 2>/dev/null; then
      warn "Disk: ${avail_mb}MB free (critically low, need 500MB+)"
      has_issues=true
    elif [ "$avail_mb" -lt 1024 ] 2>/dev/null; then
      warn "Disk: ${avail_mb}MB free (low, recommend 1GB+)"
    elif [ "$avail_gb" -gt 0 ] 2>/dev/null; then
      success "Disk: ${avail_gb}GB free"
    else
      success "Disk: ${avail_mb}MB free"
    fi
  fi

  # Data directory size
  if [ -d "$KINBOT_DATA_DIR" ]; then
    local data_size
    data_size="$(du -sh "$KINBOT_DATA_DIR" 2>/dev/null | awk '{print $1}')"
    [ -n "$data_size" ] && info "Data directory size: $data_size"
  fi

  # Log file size (for script-managed installs)
  if [ "$INIT_SYSTEM" = "script" ]; then
    local log_file="$KINBOT_DATA_DIR/kinbot.log"
    if [ -f "$log_file" ]; then
      local log_kb
      log_kb="$(du -k "$log_file" 2>/dev/null | awk '{print $1}')" || log_kb="0"
      if [ "$log_kb" -gt 102400 ] 2>/dev/null; then
        local log_mb=$((log_kb / 1024))
        warn "Log file: ${log_mb}MB (large, run: bash install.sh --start && $KINBOT_DIR/kinbot log-rotate)"
        has_issues=true
      elif [ "$log_kb" -gt 10240 ] 2>/dev/null; then
        local log_mb=$((log_kb / 1024))
        info "Log file: ${log_mb}MB"
      fi
    fi
  fi

  # Check for available updates
  header "Updates"
  if [ -d "$KINBOT_DIR/.git" ]; then
    local local_ref remote_ref
    local_ref="$(git -C "$KINBOT_DIR" rev-parse HEAD 2>/dev/null || echo "")"
    local branch
    branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "main")"

    if [ -n "$local_ref" ] && git -C "$KINBOT_DIR" fetch origin "$branch" --quiet 2>/dev/null; then
      remote_ref="$(git -C "$KINBOT_DIR" rev-parse "origin/$branch" 2>/dev/null || echo "")"

      if [ -n "$remote_ref" ] && [ "$local_ref" != "$remote_ref" ]; then
        local behind_count
        behind_count="$(git -C "$KINBOT_DIR" rev-list HEAD.."origin/$branch" --count 2>/dev/null || echo "0")"
        if [ "$behind_count" -gt 0 ] 2>/dev/null; then
          # Check if there's a newer tag on remote
          local local_tag remote_tag
          local_tag="$(git -C "$KINBOT_DIR" describe --tags --abbrev=0 HEAD 2>/dev/null || echo "")"
          remote_tag="$(git -C "$KINBOT_DIR" describe --tags --abbrev=0 "origin/$branch" 2>/dev/null || echo "")"

          if [ -n "$remote_tag" ] && [ "$remote_tag" != "$local_tag" ]; then
            echo -e "  ${CYAN}⬆${NC}  ${BOLD}Update available:${NC} ${local_tag:-$(echo "$local_ref" | cut -c1-8)} → ${BOLD}${remote_tag}${NC} (${behind_count} commit(s) behind)"
          else
            echo -e "  ${CYAN}⬆${NC}  ${BOLD}Update available:${NC} ${behind_count} new commit(s) on ${branch}"
          fi
          echo -e "  ${DIM}   Run: bash install.sh --update${NC}"
        fi
      else
        success "Up to date"
      fi
    else
      info "Could not check for updates (network unavailable)"
    fi
  else
    info "Cannot check updates (not a git install)"
  fi

  # Summary
  echo ""
  if [ "$has_issues" = true ]; then
    echo -e "${YELLOW}${BOLD}Some issues detected.${NC} Check the warnings above."
  else
    echo -e "${GREEN}${BOLD}Everything looks good!${NC}"
  fi
  echo ""
}

# Non-fatal error (for status checks)
error_noexit() { echo -e "${RED}✗${NC} $*" >&2; }

# ─── Service lifecycle (start/stop/restart) ──────────────────────────────────
# Helpers to manage the KinBot service from the installer itself,
# so users don't need to remember systemctl vs launchctl vs script commands.

_service_env_setup() {
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi
  detect_os
}

_service_start() {
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    if [ ! -f "$plist" ]; then
      error "launchd service not installed. Run the installer first: bash install.sh"
    fi
    if launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      warn "KinBot is already running"
      return 0
    fi
    launchctl load "$plist"
    success "KinBot started (launchd)"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    if [ ! -x "$script_path" ]; then
      error "Service script not found. Run the installer first: bash install.sh"
    fi
    "$script_path" start
  elif [ "$IS_ROOT" = true ]; then
    if ! systemctl is-enabled --quiet kinbot 2>/dev/null; then
      error "systemd service not installed. Run the installer first: sudo bash install.sh"
    fi
    if systemctl is-active --quiet kinbot 2>/dev/null; then
      warn "KinBot is already running"
      return 0
    fi
    systemctl start kinbot
    success "KinBot started (systemd)"
  else
    if ! systemctl --user is-enabled --quiet kinbot 2>/dev/null; then
      error "systemd user service not installed. Run the installer first: bash install.sh"
    fi
    if systemctl --user is-active --quiet kinbot 2>/dev/null; then
      warn "KinBot is already running"
      return 0
    fi
    systemctl --user start kinbot
    success "KinBot started (systemd user service)"
  fi
}

_service_stop() {
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    if ! launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      warn "KinBot is not running"
      return 0
    fi
    launchctl unload "$plist" 2>/dev/null || true
    success "KinBot stopped (launchd)"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    if [ ! -x "$script_path" ]; then
      error "Service script not found at $script_path"
    fi
    "$script_path" stop
  elif [ "$IS_ROOT" = true ]; then
    if ! systemctl is-active --quiet kinbot 2>/dev/null; then
      warn "KinBot is not running"
      return 0
    fi
    systemctl stop kinbot
    success "KinBot stopped (systemd)"
  else
    if ! systemctl --user is-active --quiet kinbot 2>/dev/null; then
      warn "KinBot is not running"
      return 0
    fi
    systemctl --user stop kinbot
    success "KinBot stopped (systemd user service)"
  fi
}

do_start() {
  echo ""
  _service_env_setup
  if [ ! -d "$KINBOT_DIR/.git" ]; then
    error "KinBot is not installed at $KINBOT_DIR. Run the installer first: bash install.sh"
  fi
  _service_start
  echo ""
}

do_stop() {
  echo ""
  _service_env_setup
  if [ ! -d "$KINBOT_DIR/.git" ]; then
    error "KinBot is not installed at $KINBOT_DIR. Run the installer first: bash install.sh"
  fi
  _service_stop
  echo ""
}

do_restart() {
  echo ""
  _service_env_setup
  if [ ! -d "$KINBOT_DIR/.git" ]; then
    error "KinBot is not installed at $KINBOT_DIR. Run the installer first: bash install.sh"
  fi
  info "Restarting KinBot..."

  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    launchctl unload "$plist" 2>/dev/null || true
    sleep 1
    launchctl load "$plist"
    success "KinBot restarted (launchd)"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    if [ ! -x "$script_path" ]; then
      error "Service script not found at $script_path"
    fi
    "$script_path" restart
  elif [ "$IS_ROOT" = true ]; then
    systemctl restart kinbot
    success "KinBot restarted (systemd)"
  else
    systemctl --user restart kinbot
    success "KinBot restarted (systemd user service)"
  fi
  echo ""
}

# ─── Doctor (diagnostic report for bug reports) ─────────────────────────────
do_doctor() {
  # Minimal env setup
  OS="$(uname -s)"
  ARCH="$(uname -m)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  detect_os 2>/dev/null || true

  # Everything goes to stdout as plain text, suitable for pasting into a GitHub issue
  echo "# KinBot Diagnostic Report"
  echo "Generated: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
  echo ""

  # ── System ──
  echo "## System"
  echo "- OS: $OS ($ARCH)"
  echo "- Distro: ${DISTRO:-unknown}"
  [ "$IS_WSL" = true ] && echo "- WSL: yes"
  if [ -f /proc/version ]; then
    echo "- Kernel: $(uname -r)"
  elif [ "$OS" = "Darwin" ]; then
    echo "- macOS: $(sw_vers -productVersion 2>/dev/null || echo unknown)"
  fi
  echo "- Init: ${INIT_SYSTEM:-unknown}"
  echo "- User: $(id -un) (uid=$(id -u))"
  echo "- Shell: ${SHELL:-unknown}"

  # Container detection
  local container="none"
  if [ -f /.dockerenv ]; then
    container="docker"
  elif grep -qa 'container=' /proc/1/environ 2>/dev/null; then
    container="$(grep -oP 'container=\K[^ ]+' /proc/1/environ 2>/dev/null || echo "yes")"
  elif [ -f /run/host/container-manager ] 2>/dev/null; then
    container="$(cat /run/host/container-manager 2>/dev/null)"
  fi
  [ "$container" != "none" ] && echo "- Container: $container"

  # Memory
  if [ "$OS" = "Linux" ] && [ -f /proc/meminfo ]; then
    local mem_total mem_avail swap_total
    mem_total="$(awk '/^MemTotal:/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null)"
    mem_avail="$(awk '/^MemAvailable:/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null)"
    swap_total="$(awk '/^SwapTotal:/ {printf "%.0f", $2/1024}' /proc/meminfo 2>/dev/null)"
    echo "- Memory: ${mem_avail:-?}MB available / ${mem_total:-?}MB total, swap ${swap_total:-0}MB"
  elif [ "$OS" = "Darwin" ]; then
    local mem_bytes
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
    echo "- Memory: $((mem_bytes / 1024 / 1024))MB total"
  fi

  # Disk
  local install_parent
  install_parent="$(dirname "$KINBOT_DIR")"
  local disk_info
  disk_info="$(df -h "$install_parent" 2>/dev/null | awk 'NR==2 {printf "%s available / %s total (%s used)", $4, $2, $5}')"
  [ -n "$disk_info" ] && echo "- Disk ($install_parent): $disk_info"

  echo ""

  # ── KinBot installation ──
  echo "## KinBot"
  if [ -d "$KINBOT_DIR/.git" ]; then
    local version branch commit commit_date
    version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || echo "no tags")"
    branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "unknown")"
    commit="$(git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    commit_date="$(git -C "$KINBOT_DIR" log -1 --format='%ci' 2>/dev/null | cut -d' ' -f1 || echo "unknown")"
    echo "- Version: $version"
    echo "- Branch: $branch"
    echo "- Commit: $commit ($commit_date)"
    echo "- Install dir: $KINBOT_DIR"

    # Check if behind upstream
    local behind=""
    if git -C "$KINBOT_DIR" fetch --dry-run origin "$branch" 2>&1 | grep -q "$branch"; then
      local local_head remote_head
      local_head="$(git -C "$KINBOT_DIR" rev-parse HEAD 2>/dev/null)"
      remote_head="$(git -C "$KINBOT_DIR" rev-parse "origin/$branch" 2>/dev/null)"
      if [ "$local_head" != "$remote_head" ]; then
        local count_behind
        count_behind="$(git -C "$KINBOT_DIR" rev-list HEAD..origin/"$branch" --count 2>/dev/null || echo "?")"
        echo "- Behind upstream: $count_behind commit(s)"
      else
        echo "- Up to date with origin/$branch"
      fi
    fi

    # Dirty state
    if ! git -C "$KINBOT_DIR" diff --quiet HEAD 2>/dev/null; then
      echo "- Working tree: DIRTY (uncommitted changes)"
    fi
  else
    echo "- Not installed at $KINBOT_DIR"
  fi

  echo "- Data dir: $KINBOT_DATA_DIR"
  if [ -d "$KINBOT_DATA_DIR" ]; then
    local data_size
    data_size="$(du -sh "$KINBOT_DATA_DIR" 2>/dev/null | awk '{print $1}')"
    echo "- Data size: $data_size"
  fi

  echo ""

  # ── Runtime ──
  echo "## Runtime"
  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun &>/dev/null; then
    echo "- Bun: $(bun --version 2>/dev/null || echo error) ($(command -v bun))"
  else
    echo "- Bun: NOT FOUND"
  fi
  command -v git &>/dev/null && echo "- Git: $(git --version 2>/dev/null | awk '{print $3}')"
  command -v curl &>/dev/null && echo "- Curl: $(curl --version 2>/dev/null | head -1 | awk '{print $2}')"
  command -v sqlite3 &>/dev/null && echo "- SQLite3: $(sqlite3 --version 2>/dev/null | awk '{print $1}')"

  echo ""

  # ── Config (sanitized) ──
  echo "## Config"
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  if [ -f "$env_file" ]; then
    local perms
    perms="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file" 2>/dev/null || echo "?")"
    echo "- File: $env_file (permissions: $perms)"
    echo '```'
    # Show keys and redact sensitive values
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      [[ "$line" =~ ^# ]] && { echo "$line"; continue; }
      local key="${line%%=*}"
      local val="${line#*=}"
      case "$key" in
        *KEY*|*SECRET*|*TOKEN*|*PASSWORD*|*ENCRYPTION*)
          if [ -n "$val" ]; then
            echo "${key}=[REDACTED (${#val} chars)]"
          else
            echo "${key}="
          fi
          ;;
        *)
          echo "$line"
          ;;
      esac
    done < "$env_file"
    echo '```'
  else
    echo "- Config file not found at $env_file"
  fi

  echo ""

  # ── Database ──
  echo "## Database"
  local db_file="$KINBOT_DATA_DIR/kinbot.db"
  if [ -f "$db_file" ]; then
    local db_size
    db_size="$(du -h "$db_file" 2>/dev/null | awk '{print $1}')"
    echo "- File: $db_file ($db_size)"
    if command -v sqlite3 &>/dev/null; then
      local integrity journal_mode table_count
      integrity="$(sqlite3 "$db_file" "PRAGMA integrity_check;" 2>/dev/null || echo "error")"
      journal_mode="$(sqlite3 "$db_file" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")"
      table_count="$(sqlite3 "$db_file" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "?")"
      echo "- Integrity: $integrity"
      echo "- Journal mode: $journal_mode"
      echo "- Tables: $table_count"
    else
      echo "- sqlite3 not available for inspection"
    fi
  else
    echo "- Not found at $db_file"
  fi

  # Backups
  local backup_dir="$KINBOT_DATA_DIR/backups"
  if [ -d "$backup_dir" ]; then
    local backup_count
    backup_count="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
    echo "- Backups: $backup_count"
  fi

  echo ""

  # ── Service ──
  echo "## Service"
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    if launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      echo "- Status: loaded (launchd)"
    else
      echo "- Status: not loaded (launchd)"
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      echo "- Status: running (PID $(cat "$pid_file"), script-managed)"
    else
      echo "- Status: not running (script-managed)"
    fi
  elif [ "$IS_ROOT" = true ]; then
    local svc_status
    svc_status="$(systemctl is-active kinbot 2>/dev/null || echo "unknown")"
    echo "- Status: $svc_status (systemd system)"
    if [ "$svc_status" = "failed" ]; then
      echo "- Exit code: $(systemctl show kinbot -p ExecMainStatus --value 2>/dev/null || echo "?")"
    fi
  else
    local svc_status
    svc_status="$(systemctl --user is-active kinbot 2>/dev/null || echo "unknown")"
    echo "- Status: $svc_status (systemd user)"
    if [ "$svc_status" = "failed" ]; then
      echo "- Exit code: $(systemctl --user show kinbot -p ExecMainStatus --value 2>/dev/null || echo "?")"
    fi
  fi

  # Port check
  local port="${KINBOT_PORT:-3000}"
  if [ -f "$KINBOT_DATA_DIR/kinbot.env" ]; then
    # shellcheck disable=SC1090
    . "$KINBOT_DATA_DIR/kinbot.env" 2>/dev/null || true
    port="${PORT:-$port}"
  fi

  local port_listening="no"
  if command -v ss &>/dev/null; then
    ss -tlnp 2>/dev/null | grep -q ":${port} " && port_listening="yes"
  elif command -v lsof &>/dev/null; then
    lsof -i ":${port}" -sTCP:LISTEN &>/dev/null && port_listening="yes"
  fi
  echo "- Port $port listening: $port_listening"

  # HTTP check
  if command -v curl &>/dev/null && [ "$port_listening" = "yes" ]; then
    local http_code
    http_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/" --max-time 3 2>/dev/null || echo "000")"
    echo "- HTTP status: $http_code"
    local api_code
    api_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/api/health" --max-time 3 2>/dev/null || echo "000")"
    echo "- API health: $api_code"
  fi

  # Public URL reachability & TLS
  local public_url=""
  if [ -f "$env_file" ]; then
    # shellcheck disable=SC1090
    public_url="$( ( . "$env_file" 2>/dev/null; echo "${PUBLIC_URL:-}" ) )"
  fi
  if [ -n "$public_url" ]; then
    echo "- Public URL: $public_url"
    local url_host
    url_host="$(echo "$public_url" | sed -E 's|^https?://||; s|[:/].*||')"

    local is_local=false
    case "$url_host" in
      localhost|127.*|10.*|192.168.*) is_local=true ;;
      172.*)
        local so
        so="$(echo "$url_host" | cut -d. -f2)"
        [ -n "$so" ] && [ "$so" -ge 16 ] 2>/dev/null && [ "$so" -le 31 ] 2>/dev/null && is_local=true
        ;;
    esac

    if [ "$is_local" = false ] && command -v curl &>/dev/null; then
      local public_code
      public_code="$(curl -s -o /dev/null -w '%{http_code}' "$public_url" --max-time 8 2>/dev/null || echo "000")"
      echo "- Public URL reachable: $([ "$public_code" != "000" ] && echo "yes (status $public_code)" || echo "NO")"

      if [[ "$public_url" =~ ^https:// ]] && command -v openssl &>/dev/null; then
        local cert_expiry
        cert_expiry="$(echo | openssl s_client -servername "$url_host" -connect "$url_host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//')"
        if [ -n "$cert_expiry" ]; then
          local expiry_epoch now_epoch
          expiry_epoch="$(date -d "$cert_expiry" +%s 2>/dev/null || date -jf '%b %d %T %Y %Z' "$cert_expiry" +%s 2>/dev/null || echo "")"
          now_epoch="$(date +%s)"
          if [ -n "$expiry_epoch" ]; then
            local days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
            echo "- TLS certificate: expires in ${days_left} days ($cert_expiry)"
          else
            echo "- TLS certificate: $cert_expiry (could not parse date)"
          fi
        else
          echo "- TLS certificate: could not retrieve"
        fi
      fi
    elif [ "$is_local" = true ]; then
      echo "- Public URL: local address (external reachability not tested)"
    fi
  fi

  echo ""

  # ── Recent logs ──
  echo "## Recent Logs (last 25 lines)"
  echo '```'
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local log_file="$HOME/Library/Logs/kinbot/kinbot.log"
    if [ -f "$log_file" ]; then
      tail -25 "$log_file" 2>/dev/null
    else
      echo "(no log file found)"
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local log_file="$KINBOT_DATA_DIR/kinbot.log"
    if [ -f "$log_file" ]; then
      tail -25 "$log_file" 2>/dev/null
    else
      echo "(no log file found)"
    fi
  elif [ "$IS_ROOT" = true ]; then
    journalctl -u kinbot --no-pager -n 25 2>/dev/null || echo "(no journal entries)"
  else
    journalctl --user -u kinbot --no-pager -n 25 2>/dev/null || echo "(no journal entries)"
  fi
  echo '```'

  echo ""
  echo "---"
  echo "Paste this into a GitHub issue: https://github.com/$KINBOT_REPO/issues/new"
}

# ─── Dry run ─────────────────────────────────────────────────────────────────
dry_run() {
  echo ""
  echo -e "${BOLD}KinBot Installer — Dry Run${NC}"
  echo -e "${DIM}No changes will be made. This shows what would happen.${NC}"
  echo ""

  detect_os

  # Check existing installation
  header "Installation plan"
  if [ -d "$KINBOT_DIR/.git" ]; then
    local current_version
    current_version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    info "Mode: ${BOLD}UPDATE${NC} (existing install at $KINBOT_DIR, currently $current_version)"
  else
    info "Mode: ${BOLD}FRESH INSTALL${NC}"
    info "Will clone to: $KINBOT_DIR"
  fi
  info "Data directory: $KINBOT_DATA_DIR"
  info "Branch: $KINBOT_BRANCH"

  # Prerequisites
  header "Prerequisites"
  for cmd in git curl unzip; do
    if command -v "$cmd" &>/dev/null; then
      success "$cmd — already installed"
    else
      info "$cmd — ${YELLOW}will be installed${NC}"
    fi
  done

  # Bun
  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun &>/dev/null; then
    local bun_ver
    bun_ver="$(bun --version 2>/dev/null || echo "0.0.0")"
    if version_gte "$bun_ver" "$BUN_MIN_VERSION"; then
      success "Bun v${bun_ver} — already installed (meets v${BUN_MIN_VERSION}+ requirement)"
    else
      info "Bun v${bun_ver} — ${YELLOW}will be upgraded${NC} (need v${BUN_MIN_VERSION}+)"
    fi
  else
    info "Bun — ${YELLOW}will be installed${NC} from https://bun.sh"
  fi

  # Disk space & memory
  header "Resources"
  local install_parent
  install_parent="$(dirname "$KINBOT_DIR")"
  local avail_kb
  if avail_kb="$(df -k "$install_parent" 2>/dev/null | awk 'NR==2 {print $4}')"; then
    local avail_mb=$((avail_kb / 1024))
    if [ "$avail_mb" -lt 500 ] 2>/dev/null; then
      warn "Disk: only ${avail_mb}MB available (need 500MB+)"
    else
      success "Disk: ${avail_mb}MB available"
    fi
  fi

  if [ "$OS" = "Linux" ] && [ -f /proc/meminfo ]; then
    local mem_total_kb mem_avail_kb swap_total_kb
    mem_total_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"
    mem_avail_kb="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"
    swap_total_kb="$(awk '/^SwapTotal:/ {print $2}' /proc/meminfo 2>/dev/null || echo "")"
    if [ -n "$mem_total_kb" ]; then
      local mem_total_mb=$((mem_total_kb / 1024))
      local mem_avail_mb=0
      [ -n "$mem_avail_kb" ] && mem_avail_mb=$((mem_avail_kb / 1024))
      local swap_total_mb=0
      [ -n "$swap_total_kb" ] && swap_total_mb=$((swap_total_kb / 1024))
      if [ "$mem_total_mb" -lt 512 ] 2>/dev/null && [ "$swap_total_mb" -lt 256 ] 2>/dev/null; then
        warn "RAM: ${mem_total_mb}MB total, ${swap_total_mb}MB swap — build may OOM"
      else
        success "RAM: ${mem_avail_mb}MB available / ${mem_total_mb}MB total"
      fi
    fi
  elif [ "$OS" = "Darwin" ]; then
    local mem_bytes
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo "")"
    if [ -n "$mem_bytes" ]; then
      local mem_total_mb=$((mem_bytes / 1024 / 1024))
      success "RAM: ${mem_total_mb}MB total"
    fi
  fi

  # Port
  header "Network"
  info "Will listen on port $KINBOT_PORT"
  local port_in_use=false
  if command -v ss &>/dev/null; then
    ss -tlnp 2>/dev/null | grep -q ":${KINBOT_PORT} " && port_in_use=true
  elif command -v lsof &>/dev/null; then
    lsof -i ":${KINBOT_PORT}" -sTCP:LISTEN &>/dev/null && port_in_use=true
  fi
  if [ "$port_in_use" = true ]; then
    warn "Port $KINBOT_PORT is currently in use"
  else
    success "Port $KINBOT_PORT is available"
  fi

  # Config
  header "Configuration"
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  if [ -d "$KINBOT_DIR/.git" ] && [ -f "$env_file" ]; then
    info "Existing config at $env_file — will be kept"
  else
    info "Will create config at $env_file"
    info "Interactive prompts for: port, public URL"
  fi

  # Service
  header "Service"
  if [ "$IS_ROOT" = true ]; then
    info "Will create system user: ${KINBOT_USER:-kinbot}"
  fi
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    info "Will create launchd service: ~/Library/LaunchAgents/io.kinbot.server.plist"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    info "Will create start/stop script: $KINBOT_DIR/kinbot"
    if [ "$IS_WSL" = true ]; then
      warn "WSL detected — service won't auto-start on boot"
    fi
  elif [ "$IS_ROOT" = true ]; then
    info "Will create systemd system service: /etc/systemd/system/kinbot.service"
  else
    info "Will create systemd user service: ~/.config/systemd/user/kinbot.service"
  fi

  # Build
  header "Build steps"
  info "bun install --frozen-lockfile"
  info "bun run build"
  info "bun run db:migrate"

  # Summary
  echo ""
  echo -e "${GREEN}${BOLD}Dry run complete.${NC} Run without --dry-run to proceed with installation."
  echo ""
}

# ─── Docker Compose install ──────────────────────────────────────────────────
docker_install() {
  echo ""
  echo -e "${BOLD}KinBot Docker Setup${NC}"
  echo -e "Generates a docker-compose.yml for running KinBot in Docker"
  echo ""

  OS="$(uname -s)"

  # Check Docker is available
  if ! command -v docker &>/dev/null; then
    error "Docker is not installed. Install it from https://docs.docker.com/get-docker/"
  fi
  success "Docker $(docker --version | awk '{print $3}' | tr -d ',')"

  # Check Docker Compose (v2 plugin or standalone)
  local compose_cmd=""
  if docker compose version &>/dev/null 2>&1; then
    compose_cmd="docker compose"
    success "Docker Compose $(docker compose version --short 2>/dev/null)"
  elif command -v docker-compose &>/dev/null; then
    compose_cmd="docker-compose"
    success "docker-compose $(docker-compose --version | awk '{print $NF}')"
  else
    error "Docker Compose is not installed. Install it from https://docs.docker.com/compose/install/"
  fi

  # Choose output directory
  local output_dir="${KINBOT_DOCKER_DIR:-./kinbot}"

  if [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
    echo ""
    echo -e "${BOLD}Configuration${NC}"
    echo -e "${DIM}Press Enter to accept the default value shown in brackets.${NC}"
    echo ""
    prompt_value output_dir "Output directory" "$output_dir"
    prompt_value KINBOT_PORT "Port" "$KINBOT_PORT"

    local local_ip
    local_ip="$(detect_local_ip)"
    local default_url="http://${local_ip}:${KINBOT_PORT}"
    [ -n "$KINBOT_PUBLIC_URL" ] && default_url="$KINBOT_PUBLIC_URL"
    prompt_value KINBOT_PUBLIC_URL "Public URL (for webhooks & invite links)" "$default_url"
  fi

  if [ -z "$KINBOT_PUBLIC_URL" ]; then
    local local_ip
    local_ip="$(detect_local_ip)"
    KINBOT_PUBLIC_URL="http://${local_ip}:${KINBOT_PORT}"
  fi

  mkdir -p "$output_dir"

  # Generate encryption key
  local enc_key
  enc_key="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"

  # Write .env
  cat > "$output_dir/.env" << ENV
# KinBot Docker configuration
# Edit these values, then run: docker compose up -d
#
# For all options, see: https://github.com/MarlBurroW/kinbot

# ── Core ─────────────────────────────────────────────────────────
PORT=${KINBOT_PORT}
PUBLIC_URL=${KINBOT_PUBLIC_URL}
ENCRYPTION_KEY=${enc_key}
LOG_LEVEL=info

# ── Resource limits ──────────────────────────────────────────────
# Adjust based on your machine. Defaults are safe for 2GB+ RAM.
# Small machines (1GB RAM): MEMORY_LIMIT=512m CPU_LIMIT=1.0
# Larger machines:          MEMORY_LIMIT=2g   CPU_LIMIT=4.0
MEMORY_LIMIT=1g
CPU_LIMIT=2.0
ENV
  chmod 600 "$output_dir/.env"

  # Write docker-compose.yml
  cat > "$output_dir/docker-compose.yml" << 'COMPOSE'
# KinBot — Self-hosted AI agent platform
# Docs: https://github.com/MarlBurroW/kinbot
#
# Quick start:  docker compose up -d
# Update:       docker compose pull && docker compose up -d
# Logs:         docker compose logs -f kinbot

services:
  kinbot:
    image: ghcr.io/marlburrow/kinbot:latest
    container_name: kinbot
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - kinbot-data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - KINBOT_DATA_DIR=/app/data
      - PUBLIC_URL=${PUBLIC_URL:-http://localhost:3000}
      - ENCRYPTION_KEY=${ENCRYPTION_KEY:-}
      - LOG_LEVEL=${LOG_LEVEL:-info}
    restart: unless-stopped

    # ── Resource limits ──────────────────────────────────────────────
    # Prevents runaway memory/CPU from affecting the host.
    # Adjust to your machine: 512m is fine for small usage,
    # increase to 1g or 2g for heavier workloads.
    deploy:
      resources:
        limits:
          memory: ${MEMORY_LIMIT:-1g}
          cpus: "${CPU_LIMIT:-2.0}"
        reservations:
          memory: 256m

    # ── Logging ──────────────────────────────────────────────────────
    # Prevents Docker logs from filling up the disk on long-running
    # installations. Keeps up to 3 x 10MB rotated log files.
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

    # ── Security hardening ───────────────────────────────────────────
    # read_only: prevents writes outside of mounted volumes
    # no-new-privileges: blocks privilege escalation inside container
    # tmpfs: provides writable /tmp without persisting to disk
    read_only: true
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:size=64m

    # ── Health check ─────────────────────────────────────────────────
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 30s
      retries: 3

volumes:
  kinbot-data:
COMPOSE

  success "Created $output_dir/docker-compose.yml"
  success "Created $output_dir/.env"

  # Ask if user wants to start now
  local start_now="y"
  if [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
    echo ""
    echo -en "  ${CYAN}?${NC} ${BOLD}Start KinBot now?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
    read -r start_now </dev/tty || start_now="y"
    [ -z "$start_now" ] && start_now="y"
  fi

  if [[ "$start_now" =~ ^[Yy]$ ]]; then
    header "Starting KinBot..."
    cd "$output_dir"
    # shellcheck disable=SC2086
    run_with_spinner "Building and starting container..." $compose_cmd up -d --build
    success "KinBot is starting!"

    # Wait a moment for health check
    info "Waiting for KinBot to be ready..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
      if curl -sf "http://localhost:${KINBOT_PORT}/api/health" --max-time 2 &>/dev/null; then
        success "KinBot is ready!"
        break
      fi
      sleep 2
      attempts=$((attempts + 1))
    done

    if [ $attempts -ge 30 ]; then
      warn "KinBot hasn't responded yet. It may still be building."
      info "Check status with: cd $output_dir && $compose_cmd logs -f"
    fi
  fi

  # Summary
  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║  KinBot Docker setup complete!             ║${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Access URL:${NC}   $KINBOT_PUBLIC_URL"
  echo -e "  ${CYAN}Directory:${NC}    $(cd "$output_dir" && pwd)"
  echo -e "  ${CYAN}Config:${NC}       $output_dir/.env"
  echo ""
  echo -e "  Visit the URL above to complete the setup wizard."
  echo -e "  You will need at least one AI provider API key"
  echo -e "  (Anthropic, OpenAI, or Google Gemini)."
  echo ""
  echo -e "  ${BOLD}Docker commands:${NC}"
  echo -e "    cd $(cd "$output_dir" && pwd)"
  echo -e "    $compose_cmd logs -f          ${DIM}# View logs${NC}"
  echo -e "    $compose_cmd restart           ${DIM}# Restart${NC}"
  echo -e "    $compose_cmd pull && $compose_cmd up -d  ${DIM}# Update${NC}"
  echo -e "    $compose_cmd down              ${DIM}# Stop${NC}"
  echo -e "    $compose_cmd down -v           ${DIM}# Stop & remove data${NC}"
  echo ""
  echo -e "  ${BOLD}Resource tuning:${NC} ${DIM}(edit .env, then: $compose_cmd up -d)${NC}"
  echo -e "    ${DIM}Small machine (1GB):  MEMORY_LIMIT=512m CPU_LIMIT=1.0${NC}"
  echo -e "    ${DIM}Default (2GB+):       MEMORY_LIMIT=1g   CPU_LIMIT=2.0${NC}"
  echo -e "    ${DIM}Larger (4GB+):        MEMORY_LIMIT=2g   CPU_LIMIT=4.0${NC}"
  echo ""
}

# ─── Logs ────────────────────────────────────────────────────────────────────
show_logs() {
  local log_lines="${LOGS_LINES:-0}"
  local log_grep="${LOGS_GREP:-}"
  local log_since="${LOGS_SINCE:-}"

  # Detect environment (minimal, no banner)
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  # Detect init system
  if [ "$OS" = "Darwin" ]; then
    INIT_SYSTEM="launchd"
  elif command -v systemctl &>/dev/null && systemctl --version &>/dev/null 2>&1; then
    INIT_SYSTEM="systemd"
  else
    INIT_SYSTEM="script"
  fi

  # Determine if we follow (default) or show last N lines
  local follow=true
  if [ "$log_lines" -gt 0 ] 2>/dev/null || [ -n "$log_grep" ] || [ -n "$log_since" ]; then
    follow=false
  fi

  # Helper: apply grep filter if requested
  _log_filter() {
    if [ -n "$log_grep" ]; then
      grep -i --color=auto -- "$log_grep" || true
    else
      cat
    fi
  }

  # For file-based logs (launchd, script)
  _show_file_logs() {
    local log_file="$1"
    if [ ! -f "$log_file" ]; then
      echo "No log file found at $log_file" >&2
      exit 1
    fi

    if [ "$follow" = true ]; then
      if [ -n "$log_grep" ]; then
        tail -f "$log_file" | grep -i --color=auto --line-buffered -- "$log_grep"
      else
        exec tail -f "$log_file"
      fi
    else
      local n="${log_lines:-100}"
      [ "$n" -eq 0 ] 2>/dev/null && n=100

      if [ -n "$log_since" ]; then
        # For file-based logs, --since is best-effort: show last N lines
        # and note that --since works best with journalctl
        echo -e "${DIM}Note: --since filtering works best with systemd/journalctl.${NC}" >&2
        echo -e "${DIM}Showing last $n lines instead.${NC}" >&2
        echo "" >&2
      fi

      tail -n "$n" "$log_file" | _log_filter
    fi
  }

  # For journalctl-based logs (systemd)
  _show_journal_logs() {
    local base_cmd=("journalctl")
    if [ "$IS_ROOT" = true ]; then
      base_cmd+=("-u" "kinbot")
    else
      base_cmd+=("--user" "-u" "kinbot")
    fi

    if [ -n "$log_since" ]; then
      base_cmd+=("--since" "$log_since")
    fi

    if [ "$follow" = true ]; then
      if [ -n "$log_grep" ]; then
        "${base_cmd[@]}" -f --no-pager | grep -i --color=auto --line-buffered -- "$log_grep"
      else
        exec "${base_cmd[@]}" -f
      fi
    else
      local n="${log_lines:-100}"
      [ "$n" -eq 0 ] 2>/dev/null && n=100
      "${base_cmd[@]}" --no-pager -n "$n" | _log_filter
    fi
  }

  if [ "$INIT_SYSTEM" = "launchd" ]; then
    _show_file_logs "$HOME/Library/Logs/kinbot/kinbot.log"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    _show_file_logs "$KINBOT_DATA_DIR/kinbot.log"
  else
    _show_journal_logs
  fi
}

# ─── Backup (standalone) ─────────────────────────────────────────────────────
do_backup() {
  echo ""
  echo -e "${BOLD}KinBot Backup${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  local db_file="$KINBOT_DATA_DIR/kinbot.db"
  local env_file="$KINBOT_DATA_DIR/kinbot.env"

  if [ ! -f "$db_file" ]; then
    error "No database found at $db_file — nothing to back up"
  fi

  # Determine output path
  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  local version_tag="manual"
  if [ -d "$KINBOT_DIR/.git" ]; then
    version_tag="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "manual")"
    version_tag="$(echo "$version_tag" | tr '/' '-')"
  fi

  local output="${1:-}"
  if [ -z "$output" ]; then
    local backup_dir="$KINBOT_DATA_DIR/backups"
    mkdir -p "$backup_dir"
    output="$backup_dir/kinbot-${version_tag}-${timestamp}.db"
  fi

  # Create parent directory if needed
  mkdir -p "$(dirname "$output")"

  # Backup using sqlite3 .backup if available (safe even while running)
  if command -v sqlite3 &>/dev/null; then
    if sqlite3 "$db_file" ".backup '$output'" 2>/dev/null; then
      success "Database backed up (sqlite3 safe copy)"
    else
      cp "$db_file" "$output"
      [ -f "${db_file}-wal" ] && cp "${db_file}-wal" "${output}-wal"
      [ -f "${db_file}-shm" ] && cp "${db_file}-shm" "${output}-shm"
      success "Database backed up (file copy)"
    fi
  else
    cp "$db_file" "$output"
    [ -f "${db_file}-wal" ] && cp "${db_file}-wal" "${output}-wal"
    [ -f "${db_file}-shm" ] && cp "${db_file}-shm" "${output}-shm"
    success "Database backed up (file copy)"
  fi

  # Also back up env file alongside
  if [ -f "$env_file" ]; then
    cp "$env_file" "${output%.db}.env"
    success "Config backed up: $(basename "${output%.db}.env")"
  fi

  local db_size
  db_size="$(du -h "$output" 2>/dev/null | awk '{print $1}')"

  echo ""
  echo -e "  ${CYAN}Backup:${NC}  $output ($db_size)"
  if [ -f "${output%.db}.env" ]; then
    echo -e "  ${CYAN}Config:${NC}  ${output%.db}.env"
  fi
  echo ""

  # Verify backup integrity if sqlite3 is available
  if command -v sqlite3 &>/dev/null; then
    local result
    result="$(sqlite3 "$output" "PRAGMA integrity_check;" 2>/dev/null || echo "error")"
    if [ "$result" = "ok" ]; then
      success "Backup integrity verified"
    else
      warn "Backup integrity check returned: $result"
    fi
  fi

  # List existing backups
  local backup_dir="$KINBOT_DATA_DIR/backups"
  if [ -d "$backup_dir" ]; then
    local count
    count="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
    if [ "$count" -gt 0 ] 2>/dev/null; then
      echo ""
      info "$count backup(s) in $backup_dir"
    fi
  fi
  echo ""
}

# ─── Restore ─────────────────────────────────────────────────────────────────
do_restore() {
  echo ""
  echo -e "${BOLD}KinBot Restore${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  # Detect init system for service control
  if [ "$OS" = "Darwin" ]; then
    INIT_SYSTEM="launchd"
  elif command -v systemctl &>/dev/null && systemctl --version &>/dev/null 2>&1; then
    INIT_SYSTEM="systemd"
  else
    INIT_SYSTEM="script"
  fi

  local backup_file="${1:-}"

  # If no file given, list available backups and let user pick
  if [ -z "$backup_file" ]; then
    local backup_dir="$KINBOT_DATA_DIR/backups"
    if [ ! -d "$backup_dir" ] || [ -z "$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null)" ]; then
      error "No backup file specified and no backups found in $backup_dir"
    fi

    echo -e "  ${BOLD}Available backups:${NC}"
    echo ""
    local i=1
    local -a backup_list=()
    while IFS= read -r f; do
      backup_list+=("$f")
      local fname size
      fname="$(basename "$f")"
      size="$(du -h "$f" 2>/dev/null | awk '{print $1}')"
      local mtime
      mtime="$(date -r "$f" '+%Y-%m-%d %H:%M' 2>/dev/null || stat -c '%y' "$f" 2>/dev/null | cut -d. -f1 || echo "unknown")"
      echo -e "  ${CYAN}$i)${NC} $fname ($size, $mtime)"
      i=$((i + 1))
    done < <(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f -printf '%T@ %p\n' 2>/dev/null | sort -rn | awk '{print $2}')

    if [ ${#backup_list[@]} -eq 0 ]; then
      error "No backups found in $backup_dir"
    fi

    echo ""
    local choice
    echo -en "  ${CYAN}?${NC} ${BOLD}Which backup to restore?${NC} ${DIM}[1-${#backup_list[@]}]${NC}: " >/dev/tty
    read -r choice </dev/tty || choice=""

    if [[ ! "$choice" =~ ^[0-9]+$ ]] || [ "$choice" -lt 1 ] || [ "$choice" -gt ${#backup_list[@]} ] 2>/dev/null; then
      error "Invalid selection"
    fi
    backup_file="${backup_list[$((choice - 1))]}"
  fi

  if [ ! -f "$backup_file" ]; then
    error "Backup file not found: $backup_file"
  fi

  # Verify backup integrity before restoring
  if command -v sqlite3 &>/dev/null; then
    local result
    result="$(sqlite3 "$backup_file" "PRAGMA integrity_check;" 2>/dev/null || echo "error")"
    if [ "$result" = "ok" ]; then
      success "Backup integrity OK"
    else
      warn "Backup integrity check returned: $result"
      echo -en "  ${YELLOW}?${NC} ${BOLD}Continue anyway?${NC} ${DIM}[y/N]${NC}: " >/dev/tty
      local cont
      read -r cont </dev/tty || cont="n"
      [[ ! "$cont" =~ ^[Yy]$ ]] && exit 1
    fi
  fi

  local db_file="$KINBOT_DATA_DIR/kinbot.db"
  local backup_size
  backup_size="$(du -h "$backup_file" 2>/dev/null | awk '{print $1}')"

  echo ""
  echo -e "  ${YELLOW}⚠ This will replace your current database with:${NC}"
  echo -e "  ${CYAN}$(basename "$backup_file")${NC} ($backup_size)"
  echo ""

  if [ "$KINBOT_YES" != true ] && [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
    echo -en "  ${YELLOW}?${NC} ${BOLD}Continue?${NC} ${DIM}[y/N]${NC}: " >/dev/tty
    local confirm
    read -r confirm </dev/tty || confirm="n"
    [[ ! "$confirm" =~ ^[Yy]$ ]] && { info "Cancelled"; exit 0; }
  fi

  # Back up current database first
  if [ -f "$db_file" ]; then
    local safety_backup
    safety_backup="$KINBOT_DATA_DIR/backups/kinbot-pre-restore-$(date +%Y%m%d-%H%M%S).db"
    mkdir -p "$(dirname "$safety_backup")"
    cp "$db_file" "$safety_backup"
    [ -f "${db_file}-wal" ] && cp "${db_file}-wal" "${safety_backup}-wal"
    [ -f "${db_file}-shm" ] && cp "${db_file}-shm" "${safety_backup}-shm"
    success "Current database saved to $(basename "$safety_backup")"
  fi

  # Stop service before replacing database
  header "Stopping KinBot..."
  local was_running=false
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    if [ -f "$plist" ] && launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      was_running=true
      launchctl unload "$plist" 2>/dev/null || true
      success "Service stopped"
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      was_running=true
      "$script_path" stop 2>/dev/null || kill "$(cat "$pid_file")" 2>/dev/null || true
      success "Service stopped"
    fi
  elif [ "$IS_ROOT" = true ]; then
    if systemctl is-active --quiet kinbot 2>/dev/null; then
      was_running=true
      systemctl stop kinbot
      success "Service stopped"
    fi
  else
    if systemctl --user is-active --quiet kinbot 2>/dev/null; then
      was_running=true
      systemctl --user stop kinbot
      success "Service stopped"
    fi
  fi

  # Replace database
  header "Restoring database..."
  cp "$backup_file" "$db_file"
  # Remove WAL/SHM from current (will be recreated) and copy from backup if they exist
  rm -f "${db_file}-wal" "${db_file}-shm"
  [ -f "${backup_file}-wal" ] && cp "${backup_file}-wal" "${db_file}-wal"
  [ -f "${backup_file}-shm" ] && cp "${backup_file}-shm" "${db_file}-shm"

  # Fix ownership if running as root
  if [ "$IS_ROOT" = true ] && id "${KINBOT_USER:-kinbot}" &>/dev/null; then
    chown "${KINBOT_USER}:${KINBOT_USER}" "$db_file" "${db_file}-wal" "${db_file}-shm" 2>/dev/null || true
  fi

  success "Database restored from $(basename "$backup_file")"

  # Also restore env file if it exists alongside the backup
  local env_backup="${backup_file%.db}.env"
  if [ -f "$env_backup" ]; then
    echo ""
    echo -en "  ${CYAN}?${NC} ${BOLD}Also restore config file?${NC} ${DIM}[y/N]${NC}: " >/dev/tty
    local restore_env
    read -r restore_env </dev/tty || restore_env="n"
    if [[ "$restore_env" =~ ^[Yy]$ ]]; then
      cp "$env_backup" "$KINBOT_DATA_DIR/kinbot.env"
      chmod 600 "$KINBOT_DATA_DIR/kinbot.env"
      success "Config restored"
    fi
  fi

  # Restart service if it was running
  if [ "$was_running" = true ]; then
    header "Restarting KinBot..."
    if [ "$INIT_SYSTEM" = "launchd" ]; then
      launchctl load "$HOME/Library/LaunchAgents/io.kinbot.server.plist" 2>/dev/null
    elif [ "$INIT_SYSTEM" = "script" ]; then
      "$KINBOT_DIR/kinbot" start 2>/dev/null || true
    elif [ "$IS_ROOT" = true ]; then
      systemctl start kinbot
    else
      systemctl --user start kinbot
    fi
    success "Service restarted"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}Restore complete!${NC}"
  if [ "$was_running" != true ]; then
    echo -e "  ${DIM}Start KinBot to use the restored database.${NC}"
  fi
  echo ""
}

# ─── Set env variable ─────────────────────────────────────────────────────────
do_env() {
  local assignment="${1:-}"

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  local env_file="$KINBOT_DATA_DIR/kinbot.env"

  # ── No argument: list all variables ──
  if [ -z "$assignment" ]; then
    if [ ! -f "$env_file" ]; then
      error "No config file found at $env_file. Run the installer first: bash install.sh"
    fi

    echo ""
    echo -e "${BOLD}KinBot Configuration${NC}"
    echo -e "${DIM}$env_file${NC}"
    echo ""

    local secret_patterns="KEY TOKEN SECRET PASSWORD PASS"
    while IFS= read -r line; do
      # Skip empty lines and comments
      [[ -z "$line" ]] && continue
      if [[ "$line" =~ ^#.*$ ]]; then
        echo -e "  ${DIM}$line${NC}"
        continue
      fi

      local k="${line%%=*}"
      local v="${line#*=}"

      # Mask secret values
      local masked=false
      for sp in $secret_patterns; do
        if echo "$k" | grep -qi "$sp"; then
          if [ ${#v} -gt 8 ]; then
            v="${v:0:4}...${v: -4}"
          elif [ -n "$v" ]; then
            v="****"
          fi
          masked=true
          break
        fi
      done

      if [ "$masked" = true ]; then
        echo -e "  ${CYAN}${k}${NC}=${DIM}${v}${NC}"
      else
        echo -e "  ${CYAN}${k}${NC}=${v}"
      fi
    done < "$env_file"

    echo ""
    return
  fi

  # ── KEY- syntax: remove a variable ──
  if [[ "$assignment" =~ ^[A-Za-z_][A-Za-z0-9_]*-$ ]]; then
    local key="${assignment%-}"

    if [ ! -f "$env_file" ]; then
      error "No config file found at $env_file. Run the installer first: bash install.sh"
    fi

    if ! grep -q "^${key}=" "$env_file" 2>/dev/null; then
      warn "$key is not set in $env_file"
      return
    fi

    local tmp_env
    tmp_env="$(mktemp)"
    while IFS= read -r line; do
      case "$line" in
        "${key}="*) ;; # skip this line
        *)          echo "$line" ;;
      esac
    done < "$env_file" > "$tmp_env"
    mv "$tmp_env" "$env_file"
    chmod 600 "$env_file"
    success "$key removed from $env_file"
    return
  fi

  # ── KEY=VALUE syntax: set a variable ──
  if [[ ! "$assignment" =~ ^[A-Za-z_][A-Za-z0-9_]*=.* ]]; then
    error "Invalid format. Usage: bash install.sh --env [KEY=VALUE | KEY-]"
  fi

  local key="${assignment%%=*}"
  local value="${assignment#*=}"

  if [ ! -f "$env_file" ]; then
    # Create the file if it doesn't exist yet (pre-install config)
    mkdir -p "$KINBOT_DATA_DIR"
    cat > "$env_file" << ENV
# KinBot configuration
NODE_ENV=production
ENV
    chmod 600 "$env_file"
  fi

  # Check if key already exists in the file
  if grep -q "^${key}=" "$env_file" 2>/dev/null; then
    # Update existing key
    local tmp_env
    tmp_env="$(mktemp)"
    while IFS= read -r line; do
      case "$line" in
        "${key}="*) echo "${key}=${value}" ;;
        *)          echo "$line" ;;
      esac
    done < "$env_file" > "$tmp_env"
    mv "$tmp_env" "$env_file"
    chmod 600 "$env_file"
    success "$key updated in $env_file"
  else
    # Append new key
    echo "${key}=${value}" >> "$env_file"
    success "$key added to $env_file"
  fi

  # Show the current value (mask secrets)
  local display_value="$value"
  local secret_keys="KEY TOKEN SECRET PASSWORD PASS"
  for sk in $secret_keys; do
    if echo "$key" | grep -qi "$sk"; then
      if [ ${#value} -gt 8 ]; then
        display_value="${value:0:4}...${value: -4}"
      else
        display_value="****"
      fi
      break
    fi
  done
  info "$key=$display_value"
}

# ─── Reconfigure ─────────────────────────────────────────────────────────────
do_config() {
  echo ""
  echo -e "${BOLD}KinBot Configuration${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  local env_file="$KINBOT_DATA_DIR/kinbot.env"

  if [ ! -f "$env_file" ]; then
    error "No config file found at $env_file. Run the installer first: bash install.sh"
  fi

  # Read current values
  local current_port current_url current_log_level current_encryption_key
  # shellcheck disable=SC1090
  . "$env_file" 2>/dev/null || true
  current_port="${PORT:-3000}"
  current_url="${PUBLIC_URL:-}"
  current_log_level="${LOG_LEVEL:-info}"
  current_encryption_key="${ENCRYPTION_KEY:-}"

  echo -e "  ${DIM}Current config: $env_file${NC}"
  echo -e "  ${DIM}Edit values below. Press Enter to keep current value.${NC}"
  echo ""

  # Core settings
  echo -e "  ${BOLD}Core${NC}"
  local new_port new_url
  prompt_value new_port "Port" "$current_port"
  prompt_value new_url "Public URL" "$current_url"

  # Logging
  echo ""
  echo -e "  ${BOLD}Logging${NC}"
  local new_log_level
  prompt_value new_log_level "Log level (debug/info/warn/error)" "$current_log_level"
  # Validate log level
  case "$new_log_level" in
    debug|info|warn|error) ;;
    *)
      warn "Invalid log level '$new_log_level', falling back to '$current_log_level'"
      new_log_level="$current_log_level"
      ;;
  esac

  # Security
  echo ""
  echo -e "  ${BOLD}Security${NC}"
  local new_encryption_key
  if [ -n "$current_encryption_key" ]; then
    local masked_key="${current_encryption_key:0:8}...${current_encryption_key: -4}"
    echo -e "  ${DIM}Encryption key is set ($masked_key). Leave blank to keep it.${NC}"
    prompt_value new_encryption_key "Encryption key" "$current_encryption_key"
  else
    echo -e "  ${DIM}No encryption key set. API keys are stored in plain text.${NC}"
    local gen_key="y"
    if [ "$KINBOT_YES" != true ] && [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
      echo -en "  ${CYAN}?${NC} ${BOLD}Generate an encryption key?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
      read -r gen_key </dev/tty || gen_key="y"
      [ -z "$gen_key" ] && gen_key="y"
    fi
    if [[ "$gen_key" =~ ^[Yy]$ ]]; then
      new_encryption_key="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')"
      success "Encryption key generated"
    else
      new_encryption_key=""
    fi
  fi

  # Check if anything changed
  local has_changes=false
  [ "$new_port" != "$current_port" ] && has_changes=true
  [ "$new_url" != "$current_url" ] && has_changes=true
  [ "$new_log_level" != "$current_log_level" ] && has_changes=true
  [ "$new_encryption_key" != "$current_encryption_key" ] && has_changes=true

  if [ "$has_changes" = false ]; then
    echo ""
    info "No changes made."
    echo ""
    exit 0
  fi

  # If port changed, check availability (unless it's our own service)
  if [ "$new_port" != "$current_port" ]; then
    local port_in_use=false
    if command -v ss &>/dev/null; then
      ss -tlnp 2>/dev/null | grep -q ":${new_port} " && port_in_use=true
    elif command -v lsof &>/dev/null; then
      lsof -i ":${new_port}" -sTCP:LISTEN &>/dev/null && port_in_use=true
    fi
    if [ "$port_in_use" = true ]; then
      warn "Port $new_port is already in use. The service may fail to start."
      echo -en "  ${YELLOW}?${NC} ${BOLD}Continue anyway?${NC} ${DIM}[y/N]${NC}: " >/dev/tty
      local cont
      read -r cont </dev/tty || cont="n"
      [[ ! "$cont" =~ ^[Yy]$ ]] && { info "Cancelled"; exit 0; }
    fi
  fi

  # Rewrite the env file preserving any extra user-added vars
  local tmp_env
  tmp_env="$(mktemp)"

  # Track which keys we've written (to append missing ones at the end)
  local wrote_log_level=false wrote_encryption_key=false

  # Update known keys, pass through everything else
  while IFS= read -r line; do
    case "$line" in
      PORT=*)             echo "PORT=${new_port}" ;;
      PUBLIC_URL=*)       echo "PUBLIC_URL=${new_url}" ;;
      LOG_LEVEL=*)        echo "LOG_LEVEL=${new_log_level}"; wrote_log_level=true ;;
      ENCRYPTION_KEY=*)   echo "ENCRYPTION_KEY=${new_encryption_key}"; wrote_encryption_key=true ;;
      *)                  echo "$line" ;;
    esac
  done < "$env_file" > "$tmp_env"

  # Append keys that weren't already in the file
  if [ "$wrote_log_level" = false ] && [ "$new_log_level" != "info" ]; then
    echo "LOG_LEVEL=${new_log_level}" >> "$tmp_env"
  fi
  if [ "$wrote_encryption_key" = false ] && [ -n "$new_encryption_key" ]; then
    echo "ENCRYPTION_KEY=${new_encryption_key}" >> "$tmp_env"
  fi

  mv "$tmp_env" "$env_file"
  chmod 600 "$env_file"

  echo ""
  if [ "$new_port" != "$current_port" ]; then
    success "Port: $current_port → $new_port"
  fi
  if [ "$new_url" != "$current_url" ]; then
    success "Public URL: $current_url → $new_url"
  fi
  if [ "$new_log_level" != "$current_log_level" ]; then
    success "Log level: $current_log_level → $new_log_level"
  fi
  if [ "$new_encryption_key" != "$current_encryption_key" ]; then
    if [ -z "$current_encryption_key" ] && [ -n "$new_encryption_key" ]; then
      success "Encryption key: set (API keys will be encrypted at rest)"
    elif [ -n "$new_encryption_key" ]; then
      success "Encryption key: updated"
    fi
  fi
  success "Config updated: $env_file"

  # Detect init system and offer restart
  if [ "$OS" = "Darwin" ]; then
    INIT_SYSTEM="launchd"
  elif command -v systemctl &>/dev/null && systemctl --version &>/dev/null 2>&1; then
    INIT_SYSTEM="systemd"
  else
    INIT_SYSTEM="script"
  fi

  local is_running=false
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    launchctl list 2>/dev/null | grep -q io.kinbot.server && is_running=true
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null && is_running=true
  elif [ "$IS_ROOT" = true ]; then
    systemctl is-active --quiet kinbot 2>/dev/null && is_running=true
  else
    systemctl --user is-active --quiet kinbot 2>/dev/null && is_running=true
  fi

  if [ "$is_running" = true ]; then
    echo ""
    local do_restart="y"
    if [ "$KINBOT_YES" != true ]; then
      echo -en "  ${CYAN}?${NC} ${BOLD}Restart KinBot now to apply changes?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
      read -r do_restart </dev/tty || do_restart="y"
      [ -z "$do_restart" ] && do_restart="y"
    fi

    if [[ "$do_restart" =~ ^[Yy]$ ]]; then
      if [ "$INIT_SYSTEM" = "launchd" ]; then
        local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
        launchctl unload "$plist" 2>/dev/null || true
        launchctl load "$plist" 2>/dev/null
      elif [ "$INIT_SYSTEM" = "script" ]; then
        "$KINBOT_DIR/kinbot" restart 2>/dev/null || true
      elif [ "$IS_ROOT" = true ]; then
        systemctl restart kinbot
      else
        systemctl --user restart kinbot
      fi
      success "KinBot restarted"

      # Quick health check
      sleep 3
      local http_code
      http_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${new_port}/" --max-time 5 2>/dev/null || echo "000")"
      if [ "$http_code" != "000" ]; then
        success "KinBot is responding on port $new_port"
      else
        warn "KinBot hasn't responded yet on port $new_port. Give it a moment."
      fi
    else
      echo ""
      info "Remember to restart KinBot for changes to take effect."
    fi
  else
    echo ""
    info "KinBot is not currently running. Changes will apply on next start."
  fi

  echo ""
}

# ─── Update (check + apply) ──────────────────────────────────────────────────
do_update() {
  echo ""
  echo -e "${BOLD}KinBot Updater${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
    KINBOT_USER="${KINBOT_USER:-kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  if [ ! -d "$KINBOT_DIR/.git" ]; then
    error "KinBot is not installed at $KINBOT_DIR. Run the installer first: bash install.sh"
  fi

  local branch
  branch="$(git -C "$KINBOT_DIR" branch --show-current 2>/dev/null || echo "main")"

  # Fetch latest from remote
  info "Checking for updates on branch ${BOLD}${branch}${NC}..."
  git -C "$KINBOT_DIR" fetch origin "$branch" --quiet 2>/dev/null || \
    error "Could not reach GitHub. Check your internet connection."

  local local_head remote_head
  local_head="$(git -C "$KINBOT_DIR" rev-parse HEAD)"
  remote_head="$(git -C "$KINBOT_DIR" rev-parse "origin/$branch" 2>/dev/null || echo "")"

  if [ -z "$remote_head" ]; then
    error "Could not resolve remote branch origin/$branch"
  fi

  if [ "$local_head" = "$remote_head" ]; then
    local version
    version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD)"
    echo ""
    echo -e "  ${GREEN}✓ Already up to date${NC} ($version)"
    echo ""
    exit 0
  fi

  # Show what's new
  local behind
  behind="$(git -C "$KINBOT_DIR" rev-list HEAD.."origin/$branch" --count 2>/dev/null || echo "?")"
  local current_version new_version
  current_version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD)"
  new_version="$(git -C "$KINBOT_DIR" describe --tags "origin/$branch" 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short "origin/$branch")"

  echo ""
  echo -e "  ${CYAN}Current:${NC}  $current_version"
  echo -e "  ${CYAN}Latest:${NC}   $new_version"
  echo -e "  ${CYAN}Changes:${NC}  $behind commit(s)"
  echo ""

  # Show categorized changelog
  show_categorized_commits "HEAD..origin/$branch" 5 || true

  # Confirm
  if [ "$KINBOT_YES" != true ] && [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
    local confirm="y"
    echo -en "  ${CYAN}?${NC} ${BOLD}Apply update?${NC} ${DIM}[Y/n]${NC}: " >/dev/tty
    read -r confirm </dev/tty || confirm="y"
    [ -z "$confirm" ] && confirm="y"
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      info "Update cancelled"
      exit 0
    fi
  fi

  echo ""

  start_timer

  # Detect OS fully for the install flow
  STEP_TOTAL=7
  STEP_CURRENT=0

  detect_os
  ensure_bun

  # Enable rollback
  trap rollback EXIT

  install_or_update
  step "Configuring"
  configure
  build_kinbot
  setup_database
  setup_system_user
  resolve_bun_path
  create_service
  verify_running

  trap - EXIT
  ROLLBACK_COMMIT=""

  print_summary
}

# ─── Reset (fix broken install, keep data) ────────────────────────────────────
do_reset() {
  echo ""
  echo -e "${BOLD}KinBot Reset${NC}"
  echo -e "${DIM}Fixes broken installations by re-cloning and rebuilding.${NC}"
  echo -e "${DIM}Your database, config, and backups are preserved.${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
    KINBOT_USER="${KINBOT_USER:-kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  if [ ! -d "$KINBOT_DIR" ] && [ ! -d "$KINBOT_DATA_DIR" ]; then
    error "No KinBot installation found. Run the installer first: bash install.sh"
  fi

  detect_os

  # Show what we'll do
  header "Plan"
  if [ -d "$KINBOT_DIR" ]; then
    local current_version="unknown"
    if [ -d "$KINBOT_DIR/.git" ]; then
      current_version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
    fi
    info "Will remove: $KINBOT_DIR (currently $current_version)"
  fi
  info "Will re-clone from: https://github.com/$KINBOT_REPO ($KINBOT_BRANCH)"
  info "Will rebuild: dependencies + build + migrations"
  if [ -d "$KINBOT_DATA_DIR" ]; then
    success "Will keep: $KINBOT_DATA_DIR (database, config, backups)"
  fi

  # Diagnose what might be wrong (informational)
  if [ -d "$KINBOT_DIR" ]; then
    header "Diagnosis"
    local issues=0

    # Check git state
    if [ -d "$KINBOT_DIR/.git" ]; then
      if ! git -C "$KINBOT_DIR" status &>/dev/null; then
        warn "Git repository is corrupted"
        issues=$((issues + 1))
      elif [ -n "$(git -C "$KINBOT_DIR" diff --stat HEAD 2>/dev/null)" ]; then
        warn "Working tree has uncommitted changes"
        issues=$((issues + 1))
      fi
    else
      warn "Not a git repository (missing .git/)"
      issues=$((issues + 1))
    fi

    # Check node_modules
    if [ ! -d "$KINBOT_DIR/node_modules" ]; then
      warn "node_modules is missing"
      issues=$((issues + 1))
    elif [ ! -f "$KINBOT_DIR/node_modules/.package-lock.json" ] && [ ! -f "$KINBOT_DIR/bun.lockb" ]; then
      warn "node_modules may be incomplete"
      issues=$((issues + 1))
    fi

    # Check build output
    if [ ! -d "$KINBOT_DIR/.output" ] && [ ! -d "$KINBOT_DIR/dist" ]; then
      warn "No build output found"
      issues=$((issues + 1))
    fi

    if [ "$issues" -eq 0 ]; then
      info "No obvious issues detected (reset will still do a clean rebuild)"
    else
      info "$issues issue(s) found — reset should fix them"
    fi
  fi

  # Confirm
  echo ""
  if [ "$KINBOT_YES" != true ] && [ "${KINBOT_NO_PROMPT:-}" != "true" ] && [ "${CI:-}" != "true" ]; then
    echo -en "  ${YELLOW}?${NC} ${BOLD}Proceed with reset?${NC} ${DIM}[y/N]${NC}: " >/dev/tty
    local confirm
    read -r confirm </dev/tty || confirm="n"
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
      info "Cancelled"
      exit 0
    fi
  fi

  echo ""
  start_timer

  STEP_TOTAL=7
  STEP_CURRENT=0

  # 1. Back up the database
  step "Backing up database"
  backup_database

  # 2. Stop the service
  step "Stopping service"
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local plist="$HOME/Library/LaunchAgents/io.kinbot.server.plist"
    if [ -f "$plist" ] && launchctl list 2>/dev/null | grep -q io.kinbot.server; then
      launchctl unload "$plist" 2>/dev/null || true
      success "Service stopped"
    else
      info "Service was not running"
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local script_path="$KINBOT_DIR/kinbot"
    local pid_file="$KINBOT_DATA_DIR/kinbot.pid"
    if [ -f "$pid_file" ] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
      if [ -x "$script_path" ]; then
        "$script_path" stop 2>/dev/null || kill "$(cat "$pid_file")" 2>/dev/null || true
      else
        kill "$(cat "$pid_file")" 2>/dev/null || true
      fi
      rm -f "$pid_file"
      success "Service stopped"
    else
      rm -f "$pid_file" 2>/dev/null
      info "Service was not running"
    fi
  elif [ "$IS_ROOT" = true ]; then
    if systemctl is-active --quiet kinbot 2>/dev/null; then
      systemctl stop kinbot
      success "Service stopped"
    else
      info "Service was not running"
    fi
  else
    if systemctl --user is-active --quiet kinbot 2>/dev/null; then
      systemctl --user stop kinbot
      success "Service stopped"
    else
      info "Service was not running"
    fi
  fi

  # 3. Remove app directory
  step "Removing old installation"
  if [ -d "$KINBOT_DIR" ]; then
    rm -rf "$KINBOT_DIR"
    success "Removed $KINBOT_DIR"
  fi

  # 4. Fresh clone
  step "Cloning KinBot"
  mkdir -p "$(dirname "$KINBOT_DIR")"
  run_with_spinner "Cloning from GitHub..." retry 3 "git clone" git clone "https://github.com/$KINBOT_REPO.git" "$KINBOT_DIR" --branch "$KINBOT_BRANCH" --depth 1
  local new_version
  new_version="$(git -C "$KINBOT_DIR" describe --tags 2>/dev/null || git -C "$KINBOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")"
  success "Cloned $new_version"

  # 5. Rebuild
  ensure_bun
  IS_UPDATE=true
  build_kinbot
  setup_database

  # 6. Fix permissions + service
  setup_system_user
  resolve_bun_path
  create_service

  # 7. Verify
  verify_running

  # Summary
  local elapsed=""
  elapsed="$(format_elapsed)"

  echo ""
  echo -e "${GREEN}${BOLD}Reset complete!${NC}"
  echo ""
  echo -e "  ${CYAN}Version:${NC}    $new_version"
  echo -e "  ${CYAN}Install:${NC}    $KINBOT_DIR"
  echo -e "  ${CYAN}Data:${NC}       $KINBOT_DATA_DIR (preserved)"
  if [ -n "${BACKUP_DB_PATH:-}" ] && [ -f "${BACKUP_DB_PATH:-}" ]; then
    echo -e "  ${CYAN}DB backup:${NC}  $(basename "$BACKUP_DB_PATH")"
  fi
  if [ "$KINBOT_HEALTHY" = true ]; then
    echo -e "  ${GREEN}●${NC} ${BOLD}Status:${NC}     Running"
  else
    echo -e "  ${YELLOW}●${NC} ${BOLD}Status:${NC}     Starting (check logs)"
  fi
  if [ -n "$elapsed" ]; then
    echo -e "  ${CYAN}Completed in:${NC} $elapsed"
  fi
  echo ""
}

# ─── Self-test ────────────────────────────────────────────────────────────────
do_test() {
  echo ""
  echo -e "${BOLD}KinBot Self-Test${NC}"
  echo -e "${DIM}Validates that the installation is functional, not just present.${NC}"
  echo ""

  # Minimal env setup
  OS="$(uname -s)"
  IS_ROOT=false
  [ "$(id -u)" -eq 0 ] && IS_ROOT=true
  if [ "$IS_ROOT" = true ]; then
    KINBOT_DIR="${KINBOT_DIR:-/opt/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-/var/lib/kinbot}"
  else
    KINBOT_DIR="${KINBOT_DIR:-$HOME/kinbot}"
    KINBOT_DATA_DIR="${KINBOT_DATA_DIR:-$HOME/.local/share/kinbot}"
  fi

  local passed=0
  local failed=0
  local warned=0

  test_pass() { passed=$((passed + 1)); success "PASS: $*"; }
  test_fail() { failed=$((failed + 1)); echo -e "${RED}✗ FAIL:${NC} $*" >&2; }
  test_warn() { warned=$((warned + 1)); warn "WARN: $*"; }

  # ── 1. Installation directory ──
  header "Source code"
  if [ -d "$KINBOT_DIR/.git" ]; then
    test_pass "Git repository exists at $KINBOT_DIR"
  else
    test_fail "No git repository at $KINBOT_DIR"
    echo ""
    echo -e "${RED}${BOLD}Cannot continue tests without an installation.${NC}"
    echo -e "${DIM}Run: bash install.sh${NC}"
    echo ""
    exit 1
  fi

  # Check for uncommitted changes / dirty state
  if git -C "$KINBOT_DIR" diff --quiet HEAD 2>/dev/null; then
    test_pass "Working tree is clean"
  else
    test_warn "Working tree has uncommitted changes"
  fi

  # Check package.json exists
  if [ -f "$KINBOT_DIR/package.json" ]; then
    test_pass "package.json exists"
  else
    test_fail "package.json missing"
  fi

  # ── 2. Build artifacts ──
  header "Build artifacts"
  local build_dir="$KINBOT_DIR/.output"
  if [ ! -d "$build_dir" ]; then
    build_dir="$KINBOT_DIR/dist"
  fi

  if [ -d "$build_dir" ]; then
    local file_count
    file_count="$(find "$build_dir" -type f 2>/dev/null | wc -l)"
    if [ "$file_count" -gt 0 ] 2>/dev/null; then
      test_pass "Build output exists ($file_count files in $(basename "$build_dir")/)"
    else
      test_fail "Build directory exists but is empty"
    fi
  else
    # Check for server entry point directly (some setups run from source)
    if [ -f "$KINBOT_DIR/src/server/index.ts" ]; then
      test_pass "Server entry point exists (src/server/index.ts)"
    else
      test_fail "No build output and no server entry point found"
    fi
  fi

  # Check node_modules
  if [ -d "$KINBOT_DIR/node_modules" ]; then
    local mod_count
    mod_count="$(find "$KINBOT_DIR/node_modules" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l)"
    if [ "$mod_count" -gt 10 ] 2>/dev/null; then
      test_pass "Dependencies installed ($mod_count packages)"
    else
      test_warn "node_modules exists but looks sparse ($mod_count packages)"
    fi
  else
    test_fail "node_modules missing (run: cd $KINBOT_DIR && bun install)"
  fi

  # ── 3. Runtime ──
  header "Runtime"
  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"
  if command -v bun &>/dev/null; then
    local bun_ver
    bun_ver="$(bun --version 2>/dev/null || echo "0.0.0")"
    BUN_MIN_VERSION="${BUN_MIN_VERSION:-1.2.0}"
    if version_gte "$bun_ver" "$BUN_MIN_VERSION"; then
      test_pass "Bun v${bun_ver} (meets v${BUN_MIN_VERSION}+ requirement)"
    else
      test_fail "Bun v${bun_ver} is below minimum v${BUN_MIN_VERSION}"
    fi

    # Verify Bun can actually execute (not just present on PATH)
    if bun -e "console.log('ok')" 2>/dev/null | grep -q "ok"; then
      test_pass "Bun runtime is functional"
    else
      test_fail "Bun is on PATH but cannot execute JavaScript"
    fi
  else
    test_fail "Bun not found on PATH"
  fi

  # ── 4. Configuration ──
  header "Configuration"
  local env_file="$KINBOT_DATA_DIR/kinbot.env"
  if [ -f "$env_file" ]; then
    test_pass "Config file exists: $env_file"

    # Check file permissions (should be 600)
    local perms
    perms="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file" 2>/dev/null || echo "unknown")"
    if [ "$perms" = "600" ]; then
      test_pass "Config file permissions are secure (600)"
    elif [ "$perms" != "unknown" ]; then
      test_warn "Config file permissions are $perms (expected 600)"
    fi

    # Validate env file syntax (no obvious errors)
    local bad_lines=0
    while IFS= read -r line; do
      [[ -z "$line" ]] && continue
      [[ "$line" =~ ^#.*$ ]] && continue
      if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        bad_lines=$((bad_lines + 1))
      fi
    done < "$env_file"
    if [ "$bad_lines" -eq 0 ]; then
      test_pass "Config file syntax is valid"
    else
      test_warn "Config file has $bad_lines suspicious line(s)"
    fi

    # Check required vars are set
    # shellcheck disable=SC1090
    if ( . "$env_file" 2>/dev/null; [ -n "${PORT:-}" ] && echo "PORT_OK" ) | grep -q "PORT_OK"; then
      test_pass "PORT is configured"
    else
      test_warn "PORT not set in config"
    fi
  else
    test_fail "Config file missing: $env_file"
  fi

  # ── 5. Database ──
  header "Database"
  local db_file="$KINBOT_DATA_DIR/kinbot.db"
  if [ -f "$db_file" ]; then
    local db_size
    db_size="$(du -h "$db_file" 2>/dev/null | awk '{print $1}')"
    test_pass "Database file exists ($db_size)"

    # Integrity check
    if command -v sqlite3 &>/dev/null; then
      local integrity
      integrity="$(sqlite3 "$db_file" "PRAGMA integrity_check;" 2>/dev/null || echo "error")"
      if [ "$integrity" = "ok" ]; then
        test_pass "Database integrity check passed"
      else
        test_fail "Database integrity check failed: $integrity"
      fi

      # Test read capability
      local table_count
      table_count="$(sqlite3 "$db_file" "SELECT count(*) FROM sqlite_master WHERE type='table';" 2>/dev/null || echo "error")"
      if [[ "$table_count" =~ ^[0-9]+$ ]] && [ "$table_count" -gt 0 ] 2>/dev/null; then
        test_pass "Database is readable ($table_count tables)"
      elif [ "$table_count" = "0" ]; then
        test_warn "Database has no tables (migrations may not have run)"
      else
        test_fail "Cannot read database: $table_count"
      fi

      # Test write capability (create and drop a temp table)
      if sqlite3 "$db_file" "CREATE TABLE IF NOT EXISTS _selftest_tmp (id INTEGER); DROP TABLE IF EXISTS _selftest_tmp;" 2>/dev/null; then
        test_pass "Database is writable"
      else
        test_fail "Database is not writable (check permissions)"
      fi
    else
      test_warn "sqlite3 not available, cannot verify database integrity"
    fi

    # Check WAL mode (recommended for concurrent access)
    if command -v sqlite3 &>/dev/null; then
      local journal_mode
      journal_mode="$(sqlite3 "$db_file" "PRAGMA journal_mode;" 2>/dev/null || echo "unknown")"
      if [ "$journal_mode" = "wal" ]; then
        test_pass "Database uses WAL mode (good for concurrent access)"
      elif [ "$journal_mode" != "unknown" ]; then
        info "Database journal mode: $journal_mode"
      fi
    fi
  else
    test_fail "Database file missing: $db_file"
  fi

  # Check backups
  local backup_dir="$KINBOT_DATA_DIR/backups"
  if [ -d "$backup_dir" ]; then
    local backup_count
    backup_count="$(find "$backup_dir" -maxdepth 1 -name 'kinbot-*.db' -type f 2>/dev/null | wc -l)"
    if [ "$backup_count" -gt 0 ] 2>/dev/null; then
      test_pass "Backups available: $backup_count"
    else
      test_warn "Backup directory exists but no backups found"
    fi
  else
    test_warn "No backup directory (run --backup to create one)"
  fi

  # ── 6. Service & HTTP ──
  header "Service & HTTP"

  # Read port from config
  local port="${KINBOT_PORT:-3000}"
  if [ -f "$env_file" ]; then
    # shellcheck disable=SC1090
    . "$env_file" 2>/dev/null || true
    port="${PORT:-$port}"
  fi

  # Check if port is listening
  local port_listening=false
  if command -v ss &>/dev/null; then
    ss -tlnp 2>/dev/null | grep -q ":${port} " && port_listening=true
  elif command -v lsof &>/dev/null; then
    lsof -i ":${port}" -sTCP:LISTEN &>/dev/null && port_listening=true
  fi

  if [ "$port_listening" = true ]; then
    test_pass "Port $port is listening"
  else
    test_fail "Port $port is not listening (service may not be running)"
  fi

  # HTTP health check
  if command -v curl &>/dev/null; then
    local http_code body
    body="$(curl -s -w '\n%{http_code}' "http://localhost:${port}/" --max-time 5 2>/dev/null || echo -e "\n000")"
    http_code="$(echo "$body" | tail -1)"

    if [ "$http_code" != "000" ]; then
      test_pass "HTTP responding (status $http_code)"
    else
      test_fail "HTTP not responding on localhost:${port}"
    fi

    # Try the API health endpoint
    local api_code
    api_code="$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:${port}/api/health" --max-time 5 2>/dev/null || echo "000")"
    if [ "$api_code" = "200" ]; then
      test_pass "API health endpoint responding (200)"
    elif [ "$api_code" != "000" ]; then
      test_warn "API health endpoint returned $api_code (expected 200)"
    else
      if [ "$port_listening" = true ]; then
        test_warn "API health endpoint not responding (server may still be starting)"
      fi
    fi

    # Check response time
    if [ "$port_listening" = true ]; then
      local time_total
      time_total="$(curl -s -o /dev/null -w '%{time_total}' "http://localhost:${port}/" --max-time 10 2>/dev/null || echo "0")"
      if [ -n "$time_total" ] && [ "$time_total" != "0" ]; then
        # Convert to ms (bash can't do float math, use awk)
        local time_ms
        time_ms="$(awk "BEGIN {printf \"%.0f\", $time_total * 1000}" 2>/dev/null || echo "?")"
        if [ "$time_ms" != "?" ] && [ "$time_ms" -lt 2000 ] 2>/dev/null; then
          test_pass "Response time: ${time_ms}ms"
        elif [ "$time_ms" != "?" ] && [ "$time_ms" -lt 5000 ] 2>/dev/null; then
          test_warn "Slow response time: ${time_ms}ms"
        elif [ "$time_ms" != "?" ]; then
          test_fail "Very slow response: ${time_ms}ms (possible issue)"
        fi
      fi
    fi
  else
    test_warn "curl not available, cannot test HTTP"
  fi

  # ── 7. Public URL & TLS ──
  local public_url=""
  if [ -f "$env_file" ]; then
    # shellcheck disable=SC1090
    public_url="$( ( . "$env_file" 2>/dev/null; echo "${PUBLIC_URL:-}" ) )"
  fi
  if [ -n "$public_url" ] && [ "$public_url" != "http://localhost:${port}" ]; then
    local url_host
    url_host="$(echo "$public_url" | sed -E 's|^https?://||; s|[:/].*||')"

    # Skip local/private IPs
    local is_local=false
    case "$url_host" in
      localhost|127.*|10.*|192.168.*) is_local=true ;;
      172.*)
        local second_octet
        second_octet="$(echo "$url_host" | cut -d. -f2)"
        [ -n "$second_octet" ] && [ "$second_octet" -ge 16 ] 2>/dev/null && [ "$second_octet" -le 31 ] 2>/dev/null && is_local=true
        ;;
    esac

    if [ "$is_local" = false ]; then
      header "Public URL & TLS"
      if command -v curl &>/dev/null; then
        local public_code
        public_code="$(curl -s -o /dev/null -w '%{http_code}' "$public_url" --max-time 8 2>/dev/null || echo "000")"
        if [ "$public_code" != "000" ]; then
          test_pass "Public URL reachable: $public_url (status $public_code)"
        else
          test_fail "Public URL not reachable: $public_url (webhooks will fail)"
        fi

        # TLS certificate check
        if [[ "$public_url" =~ ^https:// ]] && command -v openssl &>/dev/null; then
          local cert_expiry
          cert_expiry="$(echo | openssl s_client -servername "$url_host" -connect "$url_host:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/notAfter=//')"
          if [ -n "$cert_expiry" ]; then
            local expiry_epoch now_epoch
            expiry_epoch="$(date -d "$cert_expiry" +%s 2>/dev/null || date -jf '%b %d %T %Y %Z' "$cert_expiry" +%s 2>/dev/null || echo "")"
            now_epoch="$(date +%s)"
            if [ -n "$expiry_epoch" ]; then
              local cert_days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
              if [ "$cert_days_left" -lt 0 ] 2>/dev/null; then
                test_fail "TLS certificate EXPIRED"
              elif [ "$cert_days_left" -lt 7 ] 2>/dev/null; then
                test_warn "TLS certificate expires in ${cert_days_left} day(s)"
              elif [ "$cert_days_left" -lt 30 ] 2>/dev/null; then
                test_warn "TLS certificate expires in ${cert_days_left} days"
              else
                test_pass "TLS certificate valid (${cert_days_left} days remaining)"
              fi
            else
              test_warn "Could not parse TLS certificate expiry date"
            fi
          else
            test_warn "Could not retrieve TLS certificate from $url_host"
          fi
        fi
      fi
    fi
  fi

  # ── Summary ──
  echo ""
  echo -e "${BOLD}────────────────────────────────────────${NC}"
  local total=$((passed + failed + warned))
  echo -e "  ${GREEN}$passed passed${NC}  ${RED}$failed failed${NC}  ${YELLOW}$warned warnings${NC}  ($total tests)"
  echo ""

  if [ "$failed" -eq 0 ] && [ "$warned" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}All tests passed! Your KinBot installation is healthy.${NC}"
  elif [ "$failed" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}All critical tests passed.${NC} Check warnings above for potential improvements."
  else
    echo -e "  ${RED}${BOLD}$failed test(s) failed.${NC} See above for details."
    echo -e "  ${DIM}Run 'bash install.sh' to fix most issues.${NC}"
  fi
  echo ""

  exit "$( [ "$failed" -gt 0 ] && echo 1 || echo 0 )"
}

# ─── Shell completions ────────────────────────────────────────────────────────
generate_completions() {
  local shell="${1:-bash}"

  case "$shell" in
    bash)
      cat << 'BASH_COMP'
# KinBot bash completions
# Add to ~/.bashrc:  eval "$(bash install.sh --completions bash)"
# Or:                bash install.sh --completions bash > /etc/bash_completion.d/kinbot

_kinbot_completions() {
  local cur="${COMP_WORDS[COMP_CWORD]}"
  local prev="${COMP_WORDS[COMP_CWORD-1]}"

  local commands="--help --update --docker --dry-run --reset --uninstall
    --start --stop --restart --logs --status --test --doctor
    --config --env --backup --restore --version --changelog
    --completions --yes --quiet --no-color"

  # Sub-options for specific commands
  case "$prev" in
    --logs|logs)
      COMPREPLY=( $(compgen -W "--grep --since" -- "$cur") )
      return
      ;;
    --completions|completions)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "$cur") )
      return
      ;;
    --backup|backup|--restore|restore)
      COMPREPLY=( $(compgen -f -- "$cur") )
      return
      ;;
    --grep)
      return  # free-form pattern
      ;;
    --since)
      COMPREPLY=( $(compgen -W "today yesterday '1 hour ago' '30 min ago'" -- "$cur") )
      return
      ;;
  esac

  COMPREPLY=( $(compgen -W "$commands" -- "$cur") )
}

# Support both "kinbot" (the generated script) and "install.sh"
complete -F _kinbot_completions kinbot
complete -F _kinbot_completions install.sh
BASH_COMP
      ;;

    zsh)
      cat << 'ZSH_COMP'
# KinBot zsh completions
# Add to ~/.zshrc:  eval "$(bash install.sh --completions zsh)"
# Or save to a file in your $fpath

_kinbot() {
  local -a commands=(
    '--help:Show help message'
    '--update:Check for updates and apply'
    '--docker:Docker Compose setup'
    '--dry-run:Preview without making changes'
    '--reset:Fix broken install, keep data'
    '--uninstall:Remove KinBot'
    '--start:Start the service'
    '--stop:Stop the service'
    '--restart:Restart the service'
    '--logs:Show logs (follow or last N lines)'
    '--status:Check installation health'
    '--test:Run self-tests'
    '--doctor:Generate diagnostic report'
    '--config:Re-run configuration wizard'
    '--env:Show or set env variables'
    '--backup:Back up database and config'
    '--restore:Restore from a backup'
    '--version:Show installed version'
    '--changelog:Show changes since installed version'
    '--completions:Generate shell completions'
    '--yes:Auto-confirm all prompts'
    '--quiet:Suppress non-essential output'
    '--no-color:Disable colored output'
  )

  _describe 'command' commands
}

compdef _kinbot kinbot
compdef _kinbot install.sh
ZSH_COMP
      ;;

    fish)
      cat << 'FISH_COMP'
# KinBot fish completions
# Save to: ~/.config/fish/completions/kinbot.fish

# Clear existing
complete -c kinbot -e

complete -c kinbot -l help -d 'Show help message'
complete -c kinbot -l update -d 'Check for updates and apply'
complete -c kinbot -l docker -d 'Docker Compose setup'
complete -c kinbot -l dry-run -d 'Preview without making changes'
complete -c kinbot -l reset -d 'Fix broken install, keep data'
complete -c kinbot -l uninstall -d 'Remove KinBot'
complete -c kinbot -l start -d 'Start the service'
complete -c kinbot -l stop -d 'Stop the service'
complete -c kinbot -l restart -d 'Restart the service'
complete -c kinbot -l logs -d 'Show logs'
complete -c kinbot -l status -d 'Check installation health'
complete -c kinbot -l test -d 'Run self-tests'
complete -c kinbot -l doctor -d 'Generate diagnostic report'
complete -c kinbot -l config -d 'Re-run configuration wizard'
complete -c kinbot -l env -d 'Show or set env variables'
complete -c kinbot -l backup -d 'Back up database and config'
complete -c kinbot -l restore -d 'Restore from a backup'
complete -c kinbot -l version -d 'Show installed version'
complete -c kinbot -l changelog -d 'Show changes'
complete -c kinbot -l completions -d 'Generate shell completions'
complete -c kinbot -l yes -d 'Auto-confirm all prompts'
complete -c kinbot -l quiet -d 'Suppress non-essential output'
complete -c kinbot -l no-color -d 'Disable colored output'
FISH_COMP
      ;;

    *)
      echo "Unknown shell: $shell" >&2
      echo "Supported: bash, zsh, fish" >&2
      exit 1
      ;;
  esac
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  # Handle flags
  for arg in "$@"; do
    case "$arg" in
      --help|-h|help)
        trap - INT TERM
        show_help
        exit 0
        ;;
      --uninstall|uninstall)
        trap - INT TERM
        acquire_lock
        uninstall
        release_lock
        exit 0
        ;;
      --start|start)
        trap - INT TERM
        do_start
        exit 0
        ;;
      --stop|stop)
        trap - INT TERM
        do_stop
        exit 0
        ;;
      --restart|restart)
        trap - INT TERM
        do_restart
        exit 0
        ;;
      --status|status)
        trap - INT TERM
        check_status
        exit 0
        ;;
      --test|test)
        trap - INT TERM
        do_test
        exit 0
        ;;
      --doctor|doctor)
        trap - INT TERM
        do_doctor
        exit 0
        ;;
      --logs|logs)
        trap - INT TERM
        # Parse --logs sub-options: [N] [--grep PATTERN] [--since TIME]
        local found_logs=false
        for a in "$@"; do
          if [ "$found_logs" = true ]; then
            case "$a" in
              --grep)  : ;;  # next arg is the pattern
              --since) : ;;  # next arg is the time
              --*)     break ;;
              *)
                # Could be N (number), grep pattern, or since value
                if [[ "$a" =~ ^[0-9]+$ ]]; then
                  LOGS_LINES="$a"
                fi
                ;;
            esac
          fi
          [[ "$a" = "--logs" || "$a" = "logs" ]] && found_logs=true
        done
        # Extract --grep and --since values
        local prev=""
        for a in "$@"; do
          case "$prev" in
            --grep)  LOGS_GREP="$a" ;;
            --since) LOGS_SINCE="$a" ;;
          esac
          prev="$a"
        done
        show_logs
        exit 0
        ;;
      --backup|backup)
        trap - INT TERM
        # Extract the argument after --backup/backup (skip flags like --no-color)
        local backup_path=""
        local found_flag=false
        for a in "$@"; do
          if [ "$found_flag" = true ]; then
            [[ "$a" != --* ]] && backup_path="$a" && break
          fi
          [[ "$a" = "--backup" || "$a" = "backup" ]] && found_flag=true
        done
        do_backup "$backup_path"
        exit 0
        ;;
      --restore|restore)
        trap - INT TERM
        local restore_path=""
        local found_flag=false
        for a in "$@"; do
          if [ "$found_flag" = true ]; then
            [[ "$a" != --* ]] && restore_path="$a" && break
          fi
          [[ "$a" = "--restore" || "$a" = "restore" ]] && found_flag=true
        done
        do_restore "$restore_path"
        exit 0
        ;;
      --env)
        trap - INT TERM
        # Find the KEY=VALUE or KEY- argument after --env (optional)
        local env_val=""
        local found_env=false
        for a in "$@"; do
          if [ "$found_env" = true ]; then
            [[ "$a" != --* ]] && env_val="$a" && break
          fi
          [ "$a" = "--env" ] && found_env=true
        done
        do_env "$env_val"
        exit 0
        ;;
      --config|config)
        trap - INT TERM
        do_config
        exit 0
        ;;
      --reset|reset)
        trap - INT TERM
        acquire_lock
        do_reset
        release_lock
        exit 0
        ;;
      --update|update)
        trap - INT TERM
        acquire_lock
        do_update
        release_lock
        exit 0
        ;;
      --version|-v|version)
        trap - INT TERM
        show_version
        exit 0
        ;;
      --changelog|changelog)
        trap - INT TERM
        show_changelog
        exit 0
        ;;
      --completions|completions)
        trap - INT TERM
        # Find the shell argument after --completions
        local comp_shell="bash"
        local found_comp=false
        for a in "$@"; do
          if [ "$found_comp" = true ]; then
            [[ "$a" != --* ]] && comp_shell="$a" && break
          fi
          [[ "$a" = "--completions" || "$a" = "completions" ]] && found_comp=true
        done
        generate_completions "$comp_shell"
        exit 0
        ;;
      --dry-run|dry-run)
        KINBOT_DRY_RUN=true
        ;;
      --docker|docker)
        trap - INT TERM
        acquire_lock
        docker_install
        release_lock
        exit 0
        ;;
      --quiet|-q)
        KINBOT_QUIET=true
        KINBOT_NO_PROMPT=true
        ;;
      --yes|-y)
        KINBOT_YES=true
        KINBOT_NO_PROMPT=true
        ;;
      --no-color)
        NO_COLOR=1
        setup_colors
        ;;
    esac
  done

  if [ "$KINBOT_DRY_RUN" = true ]; then
    trap - INT TERM
    dry_run
    exit 0
  fi

  # Prevent concurrent installer runs
  acquire_lock

  # Enable rollback trap for actual install/update
  trap rollback EXIT

  if [ "$KINBOT_QUIET" != true ]; then
    echo ""
    echo -e "${BOLD}KinBot Installer${NC}"
    echo -e "Self-hosted AI agent platform"
    echo -e "https://github.com/MarlBurroW/kinbot"
    echo ""
  fi

  # Check if the installer script itself is outdated (local runs only)
  check_installer_update "$@"

  start_timer

  STEP_TOTAL=9
  STEP_CURRENT=0

  detect_os
  check_prerequisites
  preflight_checks
  ensure_bun
  install_or_update
  step "Configuring"
  configure
  build_kinbot
  setup_database
  setup_system_user
  resolve_bun_path
  create_service
  verify_running

  # Disable rollback trap — we made it!
  trap - EXIT
  ROLLBACK_COMMIT=""

  release_lock
  print_summary
}

main "$@"

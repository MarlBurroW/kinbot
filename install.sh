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

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
DIM='\033[2m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${CYAN}▸${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
error()   { echo -e "${RED}✗ ERROR:${NC} $*" >&2; exit 1; }
header()  { echo -e "\n${BOLD}$*${NC}"; }

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

  # EXIT trap will fire next and handle rollback
  exit 130
}

trap cleanup_on_signal INT TERM

# ─── Spinner for long-running commands ───────────────────────────────────────
# Usage: run_with_spinner "Installing dependencies..." command arg1 arg2
run_with_spinner() {
  local label="$1"
  shift

  # If not a terminal, just run normally with a simple message
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
        DISTRO_LIKE="${ID_LIKE:-}"
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
install_pkg() {
  local pkg="$1"
  info "Installing $pkg..."
  if command -v apt-get &>/dev/null; then
    sudo apt-get install -y "$pkg" -q
  elif command -v dnf &>/dev/null; then
    sudo dnf install -y "$pkg" -q
  elif command -v yum &>/dev/null; then
    sudo yum install -y "$pkg" -q
  elif command -v brew &>/dev/null; then
    brew install "$pkg"
  else
    error "$pkg is required but could not be installed automatically. Please install it manually."
  fi
  success "$pkg installed"
}

# ─── Check prerequisites ─────────────────────────────────────────────────────
check_prerequisites() {
  header "Checking prerequisites..."

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
  header "Running pre-flight checks..."

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

  # Check internet connectivity (needed for git clone and bun install)
  if curl -fsSL --max-time 5 https://github.com >/dev/null 2>&1; then
    success "Internet connectivity OK"
  else
    error "Cannot reach github.com. Check your internet connection and try again."
  fi
}

# ─── Interactive prompt (works with curl | bash via /dev/tty) ─────────────────
# Usage: prompt_value VAR_NAME "Question" "default value"
prompt_value() {
  local var_name="$1"
  local question="$2"
  local default="$3"
  local answer

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
ensure_bun() {
  header "Checking Bun runtime..."

  BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export BUN_INSTALL
  export PATH="$BUN_INSTALL/bin:$PATH"

  if command -v bun &>/dev/null; then
    success "Bun v$(bun --version)"
    return 0
  fi

  info "Installing Bun..."
  run_with_spinner "Downloading and installing Bun..." bash -c 'curl -fsSL https://bun.sh/install | bash'
  export PATH="$BUN_INSTALL/bin:$PATH"

  command -v bun &>/dev/null || error "Bun installation failed. Install manually: https://bun.sh"
  success "Bun v$(bun --version) installed"
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
  [ -f "${db_file}-wal" ] && cp "${db_file}-wal" "${BACKUP_DB_PATH}-wal" 2>/dev/null || true
  [ -f "${db_file}-shm" ] && cp "${db_file}-shm" "${BACKUP_DB_PATH}-shm" 2>/dev/null || true

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
  header "Installing KinBot..."

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

    git -C "$KINBOT_DIR" fetch origin
    git -C "$KINBOT_DIR" checkout "$KINBOT_BRANCH"
    git -C "$KINBOT_DIR" pull origin "$KINBOT_BRANCH"

    local new_version
    new_version="$(get_installed_version)"
    if [ "$old_version" = "$new_version" ]; then
      success "Already up to date ($new_version)"
    else
      success "Updated: $old_version → $new_version"
      # Show what changed
      if [ -n "$ROLLBACK_COMMIT" ]; then
        local changes
        changes="$(git -C "$KINBOT_DIR" log --oneline "${ROLLBACK_COMMIT}..HEAD" 2>/dev/null | head -10)"
        if [ -n "$changes" ]; then
          echo ""
          echo -e "  ${DIM}Recent changes:${NC}"
          echo "$changes" | while IFS= read -r line; do
            echo -e "  ${DIM}  $line${NC}"
          done
          local total
          total="$(git -C "$KINBOT_DIR" rev-list "${ROLLBACK_COMMIT}..HEAD" --count 2>/dev/null || echo "0")"
          if [ "$total" -gt 10 ] 2>/dev/null; then
            echo -e "  ${DIM}  ... and $((total - 10)) more${NC}"
          fi
          echo ""
        fi
      fi
    fi
    IS_UPDATE=true
  else
    mkdir -p "$(dirname "$KINBOT_DIR")"
    run_with_spinner "Cloning KinBot to $KINBOT_DIR..." git clone "https://github.com/$KINBOT_REPO.git" "$KINBOT_DIR" --branch "$KINBOT_BRANCH" --depth 1
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
          [ -x "$script_path" ] && "$script_path" start 2>/dev/null || true
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
}

# ─── Build ───────────────────────────────────────────────────────────────────
build_kinbot() {
  header "Installing dependencies and building..."

  cd "$KINBOT_DIR"
  run_with_spinner "Installing dependencies..." bun install --frozen-lockfile
  run_with_spinner "Building KinBot..." bun run build
}

# ─── Database ────────────────────────────────────────────────────────────────
setup_database() {
  header "Setting up database..."

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

  cat > "$script_path" << SCRIPT
#!/usr/bin/env bash
# KinBot service manager (for systems without systemd)
set -euo pipefail

KINBOT_DIR="$KINBOT_DIR"
DATA_DIR="$KINBOT_DATA_DIR"
ENV_FILE="$env_file"
PID_FILE="$pid_file"
LOG_FILE="$log_file"
BUN_BIN="$BUN_BIN"

is_running() {
  [ -f "\$PID_FILE" ] && kill -0 "\$(cat "\$PID_FILE")" 2>/dev/null
}

case "\${1:-}" in
  start)
    if is_running; then
      echo "KinBot is already running (PID \$(cat "\$PID_FILE"))"
      exit 0
    fi
    echo "Starting KinBot..."
    cd "\$KINBOT_DIR"
    set -a
    # shellcheck disable=SC1090
    [ -f "\$ENV_FILE" ] && . "\$ENV_FILE"
    set +a
    nohup "\$BUN_BIN" src/server/index.ts >> "\$LOG_FILE" 2>&1 &
    echo \$! > "\$PID_FILE"
    echo "KinBot started (PID \$!)"
    echo "Logs: tail -f \$LOG_FILE"
    ;;
  stop)
    if ! is_running; then
      echo "KinBot is not running"
      rm -f "\$PID_FILE"
      exit 0
    fi
    _pid="\$(cat "\$PID_FILE")"
    echo "Stopping KinBot (PID \$_pid)..."
    kill "\$_pid"
    rm -f "\$PID_FILE"
    echo "KinBot stopped"
    ;;
  restart)
    "\$0" stop
    sleep 1
    "\$0" start
    ;;
  status)
    if is_running; then
      echo "KinBot is running (PID \$(cat "\$PID_FILE"))"
    else
      echo "KinBot is not running"
      rm -f "\$PID_FILE"
      exit 1
    fi
    ;;
  logs)
    tail -f "\$LOG_FILE"
    ;;
  *)
    echo "Usage: \$0 {start|stop|restart|status|logs}"
    exit 1
    ;;
esac
SCRIPT

  chmod +x "$script_path"

  # Start KinBot
  "$script_path" start
  success "KinBot started via $script_path"
}

# ─── Create service (dispatch) ───────────────────────────────────────────────
create_service() {
  header "Creating service..."

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

verify_running() {
  header "Verifying KinBot is running..."

  local url="http://localhost:${KINBOT_PORT}"
  local attempts=0
  local max_attempts=15

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

  warn "KinBot hasn't responded after ${max_attempts} attempts"
  warn "It may still be starting up. Check the logs:"
  if [ "$INIT_SYSTEM" = "launchd" ]; then
    echo -e "  ${DIM}tail -f ~/Library/Logs/kinbot/kinbot.log${NC}"
  elif [ "$INIT_SYSTEM" = "script" ]; then
    echo -e "  ${DIM}$KINBOT_DIR/kinbot logs${NC}"
  elif [ "$IS_ROOT" = true ]; then
    echo -e "  ${DIM}sudo journalctl -u kinbot -f${NC}"
  else
    echo -e "  ${DIM}journalctl --user -u kinbot -f${NC}"
  fi
}

# ─── Summary ─────────────────────────────────────────────────────────────────
print_summary() {
  ACTION="installed"
  [ "${IS_UPDATE:-false}" = true ] && ACTION="updated"

  local version
  version="$(get_installed_version)"

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
  else
    echo -en "  ${YELLOW}?${NC} ${BOLD}Remove data directory ($KINBOT_DATA_DIR)?${NC} ${DIM}This deletes your database and config [y/N]${NC}: " >/dev/tty
    read -r remove_data </dev/tty || remove_data="n"
  fi

  if [[ "$remove_data" =~ ^[Yy]$ ]]; then
    if [ -d "$KINBOT_DATA_DIR" ]; then
      rm -rf "$KINBOT_DATA_DIR"
      success "Removed $KINBOT_DATA_DIR"
    fi
  else
    info "Data kept at $KINBOT_DATA_DIR"
  fi

  echo ""
  echo -e "${GREEN}${BOLD}KinBot uninstalled.${NC}"
  echo ""
}

# ─── Version info ─────────────────────────────────────────────────────────────
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

# ─── Help ────────────────────────────────────────────────────────────────────
show_help() {
  echo ""
  echo -e "${BOLD}KinBot Installer${NC} — Self-hosted AI agent platform"
  echo ""
  echo -e "${BOLD}USAGE${NC}"
  echo "  curl -fsSL https://kinbot.sh | bash"
  echo "  bash install.sh [OPTIONS]"
  echo ""
  echo -e "${BOLD}OPTIONS${NC}"
  echo "  --help          Show this help message"
  echo "  --version       Show installed version and check for updates"
  echo "  --status        Check current KinBot installation health"
  echo "  --logs          Tail KinBot logs (works across all platforms)"
  echo "  --dry-run       Show what would happen without making changes"
  echo "  --docker        Docker Compose setup (no Bun/build needed)"
  echo "  --uninstall     Remove KinBot (keeps data unless confirmed)"
  echo ""
  echo -e "${BOLD}ENVIRONMENT VARIABLES${NC}"
  echo "  KINBOT_PORT         Port to run on (default: 3000)"
  echo "  KINBOT_DIR          Installation directory"
  echo "  KINBOT_DATA_DIR     Data directory (database, config)"
  echo "  KINBOT_PUBLIC_URL   Public URL for webhooks & invite links"
  echo "  KINBOT_BRANCH       Git branch to install (default: main)"
  echo "  KINBOT_NO_PROMPT    Skip interactive prompts (default: false)"
  echo ""
  echo -e "${BOLD}EXAMPLES${NC}"
  echo "  # Install with defaults"
  echo "  curl -fsSL https://kinbot.sh | bash"
  echo ""
  echo "  # Install on custom port, non-interactive"
  echo "  KINBOT_PORT=8080 KINBOT_NO_PROMPT=true bash install.sh"
  echo ""
  echo "  # System-wide install (as root)"
  echo "  sudo bash install.sh"
  echo ""
  echo "  # Update existing installation (just run again)"
  echo "  bash install.sh"
  echo ""
  echo "  # Docker install (no Bun required)"
  echo "  bash install.sh --docker"
  echo ""
  echo "  # Check installation health"
  echo "  bash install.sh --status"
  echo ""
  echo "  # Tail logs"
  echo "  bash install.sh --logs"
  echo ""
  echo "  # Preview what would happen"
  echo "  bash install.sh --dry-run"
  echo ""
  echo "  # Uninstall"
  echo "  bash install.sh --uninstall"
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
      # shellcheck disable=SC1090
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
    success "Bun v$(bun --version)"
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
    success "Bun v$(bun --version) — already installed"
  else
    info "Bun — ${YELLOW}will be installed${NC} from https://bun.sh"
  fi

  # Disk space
  header "Disk space"
  local install_parent
  install_parent="$(dirname "$KINBOT_DIR")"
  local avail_kb
  if avail_kb="$(df -k "$install_parent" 2>/dev/null | awk 'NR==2 {print $4}')"; then
    local avail_mb=$((avail_kb / 1024))
    if [ "$avail_mb" -lt 500 ] 2>/dev/null; then
      warn "Only ${avail_mb}MB available (need 500MB+)"
    else
      success "${avail_mb}MB available"
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

PORT=${KINBOT_PORT}
PUBLIC_URL=${KINBOT_PUBLIC_URL}
ENCRYPTION_KEY=${enc_key}
LOG_LEVEL=info
ENV
  chmod 600 "$output_dir/.env"

  # Write docker-compose.yml
  cat > "$output_dir/docker-compose.yml" << 'COMPOSE'
# KinBot — Self-hosted AI agent platform
# Docs: https://github.com/MarlBurroW/kinbot

services:
  kinbot:
    image: ghcr.io/marlburrow/kinbot:latest
    build:
      context: https://github.com/MarlBurroW/kinbot.git
      dockerfile: docker/Dockerfile
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
    healthcheck:
      test: ["CMD", "bun", "-e", "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"]
      interval: 30s
      timeout: 5s
      start_period: 15s
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
}

# ─── Logs ────────────────────────────────────────────────────────────────────
show_logs() {
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

  if [ "$INIT_SYSTEM" = "launchd" ]; then
    local log_file="$HOME/Library/Logs/kinbot/kinbot.log"
    if [ -f "$log_file" ]; then
      exec tail -f "$log_file"
    else
      echo "No log file found at $log_file" >&2
      exit 1
    fi
  elif [ "$INIT_SYSTEM" = "script" ]; then
    local log_file="$KINBOT_DATA_DIR/kinbot.log"
    if [ -f "$log_file" ]; then
      exec tail -f "$log_file"
    else
      echo "No log file found at $log_file" >&2
      exit 1
    fi
  elif [ "$IS_ROOT" = true ]; then
    exec journalctl -u kinbot -f
  else
    exec journalctl --user -u kinbot -f
  fi
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
        uninstall
        exit 0
        ;;
      --status|status)
        trap - INT TERM
        check_status
        exit 0
        ;;
      --logs|logs)
        trap - INT TERM
        show_logs
        exit 0
        ;;
      --version|-v|version)
        trap - INT TERM
        show_version
        exit 0
        ;;
      --dry-run|dry-run)
        KINBOT_DRY_RUN=true
        ;;
      --docker|docker)
        trap - INT TERM
        docker_install
        exit 0
        ;;
    esac
  done

  if [ "$KINBOT_DRY_RUN" = true ]; then
    trap - INT TERM
    dry_run
    exit 0
  fi

  # Enable rollback trap for actual install/update
  trap rollback EXIT

  echo ""
  echo -e "${BOLD}KinBot Installer${NC}"
  echo -e "Self-hosted AI agent platform"
  echo -e "https://github.com/MarlBurroW/kinbot"
  echo ""

  detect_os
  check_prerequisites
  preflight_checks
  ensure_bun
  install_or_update
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

  print_summary
}

main "$@"

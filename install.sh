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

# ─── OS detection ────────────────────────────────────────────────────────────
detect_os() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

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
      INIT_SYSTEM="systemd"
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

  if [ "$IS_ROOT" = true ]; then
    success "Detected OS: $OS ($DISTRO, $ARCH) — running as root (system install)"
  else
    success "Detected OS: $OS ($DISTRO, $ARCH) — running as $USER (user install)"
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
  curl -fsSL https://bun.sh/install | bash
  export PATH="$BUN_INSTALL/bin:$PATH"

  command -v bun &>/dev/null || error "Bun installation failed. Install manually: https://bun.sh"
  success "Bun v$(bun --version) installed"
}

# ─── Clone or update ─────────────────────────────────────────────────────────
install_or_update() {
  header "Installing KinBot..."

  if [ -d "$KINBOT_DIR/.git" ]; then
    info "Existing installation found at $KINBOT_DIR — updating..."
    git -C "$KINBOT_DIR" fetch origin
    git -C "$KINBOT_DIR" checkout "$KINBOT_BRANCH"
    git -C "$KINBOT_DIR" pull origin "$KINBOT_BRANCH"
    success "Updated to latest"
    IS_UPDATE=true
  else
    info "Cloning KinBot to $KINBOT_DIR..."
    mkdir -p "$(dirname "$KINBOT_DIR")"
    git clone "https://github.com/$KINBOT_REPO.git" "$KINBOT_DIR" --branch "$KINBOT_BRANCH" --depth 1
    success "Cloned"
    IS_UPDATE=false
  fi
}

# ─── Build ───────────────────────────────────────────────────────────────────
build_kinbot() {
  header "Installing dependencies and building..."

  cd "$KINBOT_DIR"
  bun install --frozen-lockfile
  bun run build

  success "Build complete"
}

# ─── Database ────────────────────────────────────────────────────────────────
setup_database() {
  header "Setting up database..."

  mkdir -p "$KINBOT_DATA_DIR"

  cd "$KINBOT_DIR"
  KINBOT_DATA_DIR="$KINBOT_DATA_DIR" \
  DB_PATH="$KINBOT_DATA_DIR/kinbot.db" \
    bun run db:migrate

  success "Migrations applied"
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

# ─── Create service (dispatch) ───────────────────────────────────────────────
create_service() {
  header "Creating service..."

  if [ "$INIT_SYSTEM" = "launchd" ]; then
    create_launchd_service
  elif [ "$IS_ROOT" = true ]; then
    create_systemd_system_service
  else
    create_systemd_user_service
  fi
}

# ─── Summary ─────────────────────────────────────────────────────────────────
print_summary() {
  ACTION="installed"
  [ "${IS_UPDATE:-false}" = true ] && ACTION="updated"

  echo ""
  echo -e "${BOLD}╔════════════════════════════════════════════╗${NC}"
  echo -e "${BOLD}║   KinBot ${ACTION} successfully!          ${NC}"
  echo -e "${BOLD}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  ${CYAN}Access URL:${NC}   $KINBOT_PUBLIC_URL"
  echo -e "  ${CYAN}Install dir:${NC}  $KINBOT_DIR"
  echo -e "  ${CYAN}Data dir:${NC}     $KINBOT_DATA_DIR"
  echo -e "  ${CYAN}Config file:${NC}  $KINBOT_DATA_DIR/kinbot.env"
  echo ""
  echo -e "  Visit the URL above to complete the setup wizard."
  echo -e "  You will need at least one AI provider API key"
  echo -e "  (Anthropic, OpenAI, or Google Gemini)."
  echo ""

  if [ "$INIT_SYSTEM" = "systemd" ]; then
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
  echo "  --status        Check current KinBot installation health"
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
  echo "  # Check installation health"
  echo "  bash install.sh --status"
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

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  # Handle flags
  for arg in "$@"; do
    case "$arg" in
      --help|-h|help)
        show_help
        exit 0
        ;;
      --uninstall|uninstall)
        uninstall
        exit 0
        ;;
      --status|status)
        check_status
        exit 0
        ;;
    esac
  done

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
  print_summary
}

main "$@"

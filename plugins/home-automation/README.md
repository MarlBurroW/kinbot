# 🏠 Home Automation

Control your smart home through your Kin using [Home Assistant](https://www.home-assistant.io/).

## Features

- **List entities** — browse lights, switches, sensors, climate controls, and more
- **Check states** — get detailed info on any device or sensor
- **Toggle devices** — turn lights, switches, and fans on/off
- **Call services** — advanced control (brightness, color temp, climate targets, cover positions)
- **Areas** — list rooms/areas in your home
- **Automations** — trigger automations manually
- **Scenes** — activate scenes

## Setup

1. Install the plugin from the KinBot store
2. In **Settings > Plugins > Home Automation**, configure:
   - **Home Assistant URL** — your HA instance URL (e.g. `http://homeassistant.local:8123`)
   - **Long-Lived Access Token** — generate one in HA: **Profile > Security > Long-Lived Access Tokens**
   - **Area Filter** (optional) — limit to specific rooms

## Usage Examples

> "Turn off the living room lights"

> "What's the temperature in the bedroom?"

> "Activate the movie scene"

> "List all my sensors"

> "Set the thermostat to 21°C"

## Tools

| Tool | Description | Availability |
|------|-------------|--------------|
| `list_entities` | Browse entities by domain or search | Main, Sub-Kin |
| `get_entity_state` | Get detailed state of an entity | Main, Sub-Kin |
| `toggle_entity` | Turn devices on/off/toggle | Main only |
| `call_service` | Call any HA service with custom data | Main only |
| `list_areas` | List all rooms/areas | Main, Sub-Kin |
| `run_automation` | Trigger an automation | Main only |
| `run_scene` | Activate a scene | Main only |

> **Note:** Write operations (toggle, call_service, automations, scenes) are restricted to main Kins for safety.

## Security

- Your HA token is stored encrypted in KinBot's plugin config
- The plugin only communicates with the configured HA URL
- Write operations are main-Kin only to prevent sub-Kins from making unauthorized changes

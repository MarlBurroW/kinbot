# 🕐 World Clock

Check the current time anywhere in the world, convert times between timezones, and see a global overview of clocks.

## Tools

| Tool | Description |
|------|-------------|
| `get_current_time` | Get the current date and time in any timezone |
| `convert_time` | Convert a time from one timezone to another |
| `world_clocks` | Show current time across 17 major world cities |
| `timezone_difference` | Calculate the time difference between two zones |

## Usage Examples

- "What time is it in Tokyo?"
- "Convert 3 PM New York time to Paris"
- "Show me world clocks"
- "What's the time difference between London and Sydney?"

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Home Timezone | Your default timezone (IANA format) | `UTC` |
| 24-hour format | Use 24h instead of AM/PM | `true` |

## Supported Formats

- **City names**: Tokyo, New York, Paris, London, etc.
- **Abbreviations**: PST, EST, CET, JST, etc.
- **IANA IDs**: `Europe/Paris`, `America/New_York`, etc.

No API key required. Uses the built-in JavaScript Intl API.

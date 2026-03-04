# Example Weather Plugin

A simple KinBot plugin that adds a `get_weather` tool using the [OpenWeatherMap API](https://openweathermap.org/api).

## Configuration

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `apiKey` | string (secret) | ✅ | Your OpenWeatherMap API key ([get one free](https://openweathermap.org/api)) |
| `units` | select | | Temperature units: `metric` (°C) or `imperial` (°F). Default: `metric` |

## Tool: `get_weather`

Returns current weather for a given location.

**Parameters:**
- `location` (string) — City name, e.g. `"Paris"` or `"London,UK"`

**Returns:**
- `location` — Resolved city name
- `country` — Country code
- `temperature` — Current temperature
- `feels_like` — Feels-like temperature
- `humidity` — Humidity percentage
- `description` — Weather description (e.g. "clear sky")
- `wind_speed` — Wind speed
- `units` — Temperature unit (°C or °F)

## Usage

Once configured, Kins can ask things like:
- "What's the weather in Tokyo?"
- "Is it raining in London?"

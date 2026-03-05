# 🍅 Pomodoro Timer

A Pomodoro Technique timer for your Kin. Stay focused with timed work sessions and structured breaks.

## How It Works

The [Pomodoro Technique](https://en.wikipedia.org/wiki/Pomodoro_Technique) breaks work into focused intervals:

1. **Work** for 25 minutes (configurable)
2. **Short break** for 5 minutes
3. Repeat 4 times
4. **Long break** for 15 minutes

Your Kin tracks the timer and reminds you when sessions end.

## Tools

| Tool | Description |
|------|-------------|
| `pomodoro_start` | Start a work session, optionally with a task description |
| `pomodoro_status` | Check remaining time and current state |
| `pomodoro_break` | Start a short or long break |
| `pomodoro_stop` | Cancel the current timer |
| `pomodoro_stats` | View completed pomodoros and focus time |
| `pomodoro_reset` | Reset today's count for a fresh start |

## Usage Examples

> "Start a pomodoro for writing the quarterly report"

> "How much time is left?"

> "Start my break"

> "How many pomodoros have I done today?"

## Configuration

| Setting | Default | Options |
|---------|---------|---------|
| Work Duration | 25 min | 15, 20, 25, 30, 45, 50, 60 |
| Short Break | 5 min | 3, 5, 10 |
| Long Break | 15 min | 15, 20, 25, 30 |
| Long Break After | 4 pomodoros | 3, 4, 5, 6 |

## Notes

- Timer state is kept in memory and resets when KinBot restarts
- The Kin checks the timer on each interaction, so ask about it to get updates
- Works great with task-oriented prompts to keep your Kin aware of what you're focusing on

# 📊 System Monitor

Monitor your server's health directly from KinBot. Check CPU load, memory usage, disk space, uptime, and find resource-hungry processes.

## Tools

| Tool | Description |
|------|-------------|
| `system_status` | Full overview: CPU, memory, disk, uptime |
| `top_processes` | Top processes by CPU or memory usage |
| `memory_info` | Detailed RAM and swap usage |
| `disk_info` | All mounted filesystem usage |

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Top Processes Count | Number of processes to show | 10 |

## Examples

- "How's the server doing?" → `system_status`
- "What's eating all the CPU?" → `top_processes` (sort by cpu)
- "Is disk space running low?" → `disk_info`
- "How much RAM is free?" → `memory_info`

## Permissions

No special permissions required. Uses Node.js `os` module and standard system commands (`df`, `ps`, `free`).

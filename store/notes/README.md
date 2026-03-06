# 📝 Notes

Quick note-taking for your Kin. Capture ideas, reminders, and snippets of information, organized with tags and pinning.

## Tools

| Tool | Description |
|------|-------------|
| `note_create` | Create a new note with title, content, tags, and optional pinning |
| `note_update` | Update an existing note's title, content, tags, or pin status |
| `note_delete` | Delete a note by ID |
| `note_search` | Search notes by keyword, tag, or pin status (pinned first) |
| `note_view` | View a single note with full content |
| `note_pin` | Toggle pin status on a note |

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxNotes` | select | `250` | Maximum number of notes to store (50–1000) |

## Example Usage

> "Take a note: buy milk and eggs"
> "Show me all my notes tagged 'work'"
> "Pin note-3"
> "Delete note-1"

## Notes

- Notes support markdown content
- Pinned notes always appear first in search results
- Search matches against title, content, and tags
- Notes are stored in memory per Kin instance

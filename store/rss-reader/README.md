# 📰 RSS Reader

Fetch and summarize RSS/Atom feeds directly from your Kin conversations.

## Features

- **Parse RSS 2.0 and Atom feeds** - works with most news sites, blogs, and podcasts
- **Configurable default feeds** - set your favorite sources once, fetch anytime
- **No API key required** - just point it at a feed URL

## Tools

### `fetch_rss`

Fetch and parse an RSS or Atom feed.

**Parameters:**
- `url` (optional) - Feed URL. Falls back to configured defaults.
- `maxItems` (optional) - Max items to return (1-50).

**Example prompts:**
- "What's on Hacker News right now?"
- "Fetch the latest posts from https://feeds.arstechnica.com/arstechnica/index"
- "Give me the top 5 items from my default feed"

### `list_default_feeds`

List configured default feed URLs.

## Configuration

| Setting | Description |
|---------|-------------|
| **Default Feed URLs** | Comma-separated list of RSS/Atom URLs |
| **Default Max Items** | How many items to return per fetch (5/10/15/20) |

## Popular Feed URLs

- Hacker News: `https://hnrss.org/frontpage`
- Ars Technica: `https://feeds.arstechnica.com/arstechnica/index`
- TechCrunch: `https://techcrunch.com/feed/`
- The Verge: `https://www.theverge.com/rss/index.xml`
- BBC News: `https://feeds.bbci.co.uk/news/rss.xml`
- Reddit (any sub): `https://www.reddit.com/r/programming/.rss`

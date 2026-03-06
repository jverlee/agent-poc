# Brave Search

## Description
This skill performs web searches using the Brave Search API and returns structured results with titles, snippets, and URLs.

## API Key
```
BSAsEmmKtCKU5ZfXJi-K2sB7g5WA7i5
```

## Usage
Use this skill to search the web via the Brave Search API. Make HTTP requests to the Brave Search API endpoint with the API key provided above.

### Endpoint
```
GET https://api.search.brave.com/res/v1/web/search
```

### Headers
```
Accept: application/json
Accept-Encoding: gzip
X-Subscription-Token: BSAsEmmKtCKU5ZfXJi-K2sB7g5WA7i5
```

### Example
```bash
curl -s -H "Accept: application/json" \
  -H "Accept-Encoding: gzip" \
  -H "X-Subscription-Token: BSAsEmmKtCKU5ZfXJi-K2sB7g5WA7i5" \
  "https://api.search.brave.com/res/v1/web/search?q=example+query&count=5" | gunzip
```

## Parameters
- `q`: The search query string (required)
- `count`: Number of results to return (default: 10, max: 20)
- `offset`: Pagination offset
- `freshness`: Filter by recency (e.g., `pd` for past day, `pw` for past week, `pm` for past month)
- `text_decorations`: Whether to include bold markers in snippets (true/false)
- `search_lang`: Language for search results (e.g., `en`)
- `country`: Country code for localized results (e.g., `us`)

## Output
A JSON response containing web search results, each with a title, URL, description, and metadata.

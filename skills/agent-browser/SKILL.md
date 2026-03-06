# Browser Automation

## Description
This skill controls a headless browser for web scraping, testing, and interaction automation.

## Usage
Invoke this skill to navigate web pages, fill forms, click elements, take screenshots, or extract content.

## Parameters
- `action`: The operation (navigate, click, type, screenshot, extract)
- `url`: Target URL to navigate to
- `selector`: CSS selector for the target element
- `value`: Text to type or data to submit
- `wait`: Wait condition before acting (e.g., selector, networkidle)

## Output
Page content, screenshots, or extracted data depending on the action performed.

# Memory & RAG

## Description
This skill provides persistent memory and retrieval-augmented generation (RAG) capabilities for agents using vector search.

## Usage
Invoke this skill to store, retrieve, or search through knowledge documents and conversation history for context-aware responses.

## Parameters
- `action`: The operation (store, search, list, delete)
- `content`: Text content to store in memory
- `query`: Search query for semantic retrieval
- `limit`: Maximum number of results to return
- `namespace`: Memory namespace for organization

## Output
Stored confirmation or a list of relevant memory entries ranked by similarity.

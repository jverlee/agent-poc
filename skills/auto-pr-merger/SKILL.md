# GitHub PR Automation

## Description
This skill automates GitHub pull request workflows including creation, review, and merging.

## Usage
Invoke this skill to create PRs from branches, check CI status, request reviews, or merge approved PRs.

## Parameters
- `action`: The operation to perform (create, review, merge, list)
- `repo`: Repository in owner/repo format
- `branch`: Source branch name
- `base`: Target branch (default: main)
- `title`: PR title (for create action)

## Output
PR details including URL, status, review state, and CI check results.

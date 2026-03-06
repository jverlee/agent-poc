# Scheduled Jobs

## Description
This skill manages scheduled and recurring tasks using cron-style expressions.

## Usage
Invoke this skill to create, list, or remove scheduled jobs that run commands or trigger other skills at specified intervals.

## Parameters
- `action`: The operation (create, list, remove, status)
- `schedule`: Cron expression (e.g., "0 9 * * *" for daily at 9am)
- `command`: The command or skill to execute on schedule
- `name`: Human-readable name for the job
- `id`: Job ID (for remove/status actions)

## Output
Job details including ID, schedule, next run time, and execution history.

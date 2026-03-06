# DevOps Monitor

## Description
This skill monitors system health, manages Docker containers, and tracks process status for DevOps workflows.

## Usage
Invoke this skill to check service health, restart containers, view resource usage, or get alerts on system issues.

## Parameters
- `action`: The operation (health, containers, restart, logs, resources)
- `service`: Target service or container name
- `limit`: Number of log lines to return
- `threshold`: Alert threshold for resource monitoring (e.g., cpu > 80%)

## Output
Service status, container details, resource metrics, or log output depending on the action.

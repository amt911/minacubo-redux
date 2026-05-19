#!/usr/bin/env bash
# Removes the named node_modules volume for this docker-compose project so
# the next `up` triggers a fresh `npm install` inside the container.
#
# Why this script exists: `docker compose down` does NOT delete named volumes
# and `docker compose down -v` removes ALL of them. This nukes only the
# node_modules volume, by name, scoped to the current compose project.

set -euo pipefail

PROJECT="${COMPOSE_PROJECT_NAME:-$(basename "$(pwd)")}"
PROJECT_NORM="$(printf '%s' "$PROJECT" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9_-' '_')"

for candidate in "${PROJECT_NORM}_minacubo_node_modules" "${PROJECT}_minacubo_node_modules"; do
  if docker volume inspect "$candidate" >/dev/null 2>&1; then
    echo "Removing volume: $candidate"
    docker volume rm "$candidate" >/dev/null
    exit 0
  fi
done

echo "No matching node_modules volume found for project '$PROJECT'."

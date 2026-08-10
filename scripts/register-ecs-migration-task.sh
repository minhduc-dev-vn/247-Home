#!/usr/bin/env bash
set -euo pipefail

: "${MIGRATION_TASK_DEFINITION:?MIGRATION_TASK_DEFINITION is required}"
: "${MIGRATION_IMAGE:?MIGRATION_IMAGE is required}"

if [[ ! "$MIGRATION_IMAGE" =~ @sha256:[0-9a-f]{64}$ ]]; then
  echo "MIGRATION_IMAGE must be an immutable image digest." >&2
  exit 1
fi

aws ecs describe-task-definition \
  --task-definition "$MIGRATION_TASK_DEFINITION" \
  --query taskDefinition \
  --output json > current-migration-task-definition.json

jq --arg image "$MIGRATION_IMAGE" '
  {
    family,
    taskRoleArn,
    executionRoleArn,
    networkMode,
    containerDefinitions,
    volumes,
    placementConstraints,
    requiresCompatibilities,
    cpu,
    memory,
    runtimePlatform,
    ephemeralStorage
  }
  | .containerDefinitions |= map(
      if .name == "migration" then .image = $image else . end
    )
' current-migration-task-definition.json > next-migration-task-definition.json

task_definition="$(
  aws ecs register-task-definition \
    --cli-input-json file://next-migration-task-definition.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"
test -n "$task_definition"
test "$task_definition" != "None"

registered_image="$(
  aws ecs describe-task-definition \
    --task-definition "$task_definition" \
    --query 'taskDefinition.containerDefinitions[?name==`migration`].image | [0]' \
    --output text
)"
if [[ "$registered_image" != "$MIGRATION_IMAGE" ]]; then
  echo "Registered migration image does not match the requested digest." >&2
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "task_definition_arn=$task_definition" >> "$GITHUB_OUTPUT"
  echo "registered_image=$registered_image" >> "$GITHUB_OUTPUT"
fi
echo "Migration task registered by digest: $registered_image"

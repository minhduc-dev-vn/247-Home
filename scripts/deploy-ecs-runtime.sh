#!/usr/bin/env bash
set -euo pipefail

: "${ECS_CLUSTER:?ECS_CLUSTER is required}"
: "${ECS_SERVICE:?ECS_SERVICE is required}"
: "${DEPLOY_IMAGE:?DEPLOY_IMAGE is required}"

if [[ ! "$DEPLOY_IMAGE" =~ @sha256:[0-9a-f]{64}$ ]]; then
  echo "DEPLOY_IMAGE must be an immutable image digest." >&2
  exit 1
fi

current_task_definition="$(
  aws ecs describe-services \
    --cluster "$ECS_CLUSTER" \
    --services "$ECS_SERVICE" \
    --query 'services[0].taskDefinition' \
    --output text
)"
test -n "$current_task_definition"
test "$current_task_definition" != "None"

aws ecs describe-task-definition \
  --task-definition "$current_task_definition" \
  --query taskDefinition \
  --output json > current-task-definition.json

jq --arg image "$DEPLOY_IMAGE" '
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
      if .name == "web" then .image = $image else . end
    )
' current-task-definition.json > next-task-definition.json

new_task_definition="$(
  aws ecs register-task-definition \
    --cli-input-json file://next-task-definition.json \
    --query 'taskDefinition.taskDefinitionArn' \
    --output text
)"
test -n "$new_task_definition"
test "$new_task_definition" != "None"

aws ecs update-service \
  --cluster "$ECS_CLUSTER" \
  --service "$ECS_SERVICE" \
  --task-definition "$new_task_definition" \
  --output json >/dev/null
aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE"

deployed_image="$(
  aws ecs describe-task-definition \
    --task-definition "$new_task_definition" \
    --query 'taskDefinition.containerDefinitions[?name==`web`].image | [0]' \
    --output text
)"
if [[ "$deployed_image" != "$DEPLOY_IMAGE" ]]; then
  echo "Deployed image digest does not match the requested digest." >&2
  exit 1
fi

if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
  echo "task_definition_arn=$new_task_definition" >> "$GITHUB_OUTPUT"
  echo "deployed_image=$deployed_image" >> "$GITHUB_OUTPUT"
fi
echo "ECS runtime deployed by digest: $deployed_image"

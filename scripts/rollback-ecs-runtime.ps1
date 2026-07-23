param(
  [Parameter(Mandatory = $true)]
  [string]$Cluster,

  [Parameter(Mandatory = $true)]
  [string]$Service,

  [Parameter(Mandatory = $true)]
  [string]$PreviousImageDigest,

  [Parameter(Mandatory = $true)]
  [switch]$SchemaCompatibilityApproved
)

$ErrorActionPreference = 'Stop'

if (!$SchemaCompatibilityApproved) {
  throw 'Rollback requires an explicit schema compatibility approval.'
}
if ($PreviousImageDigest -notmatch '@sha256:[0-9a-f]{64}$') {
  throw 'PreviousImageDigest must be an immutable registry digest.'
}

$currentTaskDefinition = & aws ecs describe-services `
  --cluster $Cluster `
  --services $Service `
  --query 'services[0].taskDefinition' `
  --output text
if ($LASTEXITCODE -ne 0 -or !$currentTaskDefinition -or $currentTaskDefinition -eq 'None') {
  throw 'Unable to resolve the current ECS task definition.'
}

$task = & aws ecs describe-task-definition `
  --task-definition $currentTaskDefinition `
  --query taskDefinition `
  --output json | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) {
  throw 'Unable to read the current ECS task definition.'
}

$web = $task.containerDefinitions | Where-Object { $_.name -eq 'web' } | Select-Object -First 1
if ($null -eq $web) {
  throw 'The ECS task definition does not contain the web container.'
}
$web.image = $PreviousImageDigest

$allowedFields = @(
  'family',
  'taskRoleArn',
  'executionRoleArn',
  'networkMode',
  'containerDefinitions',
  'volumes',
  'placementConstraints',
  'requiresCompatibilities',
  'cpu',
  'memory',
  'runtimePlatform',
  'ephemeralStorage'
)
$next = [ordered]@{}
foreach ($field in $allowedFields) {
  if ($null -ne $task.$field) {
    $next[$field] = $task.$field
  }
}

$taskFile = Join-Path ([System.IO.Path]::GetTempPath()) "247-home-rollback-$([guid]::NewGuid()).json"
try {
  $next | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $taskFile -Encoding utf8
  $registered = & aws ecs register-task-definition `
    --cli-input-json "file://$taskFile" `
    --query 'taskDefinition.taskDefinitionArn' `
    --output text
  if ($LASTEXITCODE -ne 0 -or !$registered -or $registered -eq 'None') {
    throw 'Unable to register the rollback task definition.'
  }

  & aws ecs update-service `
    --cluster $Cluster `
    --service $Service `
    --task-definition $registered `
    --output json | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw 'Unable to update the ECS service.'
  }
  & aws ecs wait services-stable --cluster $Cluster --services $Service
  if ($LASTEXITCODE -ne 0) {
    throw 'The ECS service did not stabilize after rollback.'
  }

  $deployed = & aws ecs describe-task-definition `
    --task-definition $registered `
    --query 'taskDefinition.containerDefinitions[?name==`web`].image | [0]' `
    --output text
  if ($LASTEXITCODE -ne 0 -or $deployed -ne $PreviousImageDigest) {
    throw 'The deployed image does not match the approved rollback digest.'
  }

  Write-Output "ECS runtime rolled back by digest: $deployed"
} finally {
  Remove-Item -LiteralPath $taskFile -Force -ErrorAction SilentlyContinue
}

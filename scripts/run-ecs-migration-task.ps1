param(
  [Parameter(Mandatory = $true)]
  [string]$Cluster,

  [Parameter(Mandatory = $true)]
  [string]$TaskDefinition,

  [Parameter(Mandatory = $true)]
  [string[]]$SubnetIds,

  [Parameter(Mandatory = $true)]
  [string]$SecurityGroupId,

  [string[]]$Command = @()
)

$ErrorActionPreference = 'Stop'
if ($SubnetIds.Count -eq 0) { throw 'At least one private subnet is required.' }
$networkConfiguration = "awsvpcConfiguration={subnets=[$($SubnetIds -join ',')],securityGroups=[$SecurityGroupId],assignPublicIp=DISABLED}"

$arguments = @(
  'ecs', 'run-task',
  '--cluster', $Cluster,
  '--task-definition', $TaskDefinition,
  '--launch-type', 'FARGATE',
  '--network-configuration', $networkConfiguration
)
if ($Command.Count -gt 0) {
  $overrides = @{
    containerOverrides = @(
      @{
        name = 'migration'
        command = $Command
      }
    )
  } | ConvertTo-Json -Depth 5 -Compress
  $arguments += @('--overrides', $overrides)
}
$arguments += @('--query', 'tasks[0].taskArn', '--output', 'text')
$taskArn = & aws @arguments
if ($LASTEXITCODE -ne 0 -or !$taskArn -or $taskArn -eq 'None') {
  throw 'ECS did not start a migration task.'
}

& aws ecs wait tasks-stopped --cluster $Cluster --tasks $taskArn
if ($LASTEXITCODE -ne 0) { throw "Migration task did not stop cleanly: $taskArn" }

$description = & aws ecs describe-tasks --cluster $Cluster --tasks $taskArn --output json |
  ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $description.tasks.Count -ne 1) {
  throw "Unable to inspect migration task: $taskArn"
}
$container = $description.tasks[0].containers |
  Where-Object { $_.name -eq 'migration' } |
  Select-Object -First 1
if ($null -eq $container -or $container.exitCode -ne 0) {
  $reason = $description.tasks[0].stoppedReason
  throw "Migration task failed (exit=$($container.exitCode), reason=$reason)."
}

if ($env:GITHUB_OUTPUT) {
  "migration_task_arn=$taskArn" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}
Write-Output "Migration task completed successfully: $taskArn"

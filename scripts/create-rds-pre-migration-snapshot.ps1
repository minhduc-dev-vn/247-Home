param(
  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[a-zA-Z][a-zA-Z0-9-]{0,62}$')]
  [string]$DbInstanceIdentifier,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^[A-Za-z0-9._-]{1,64}$')]
  [string]$ReleaseRef
)

$ErrorActionPreference = 'Stop'
$normalizedRelease = ($ReleaseRef.ToLowerInvariant() -replace '[^a-z0-9-]', '-').Trim('-')
$timestamp = [DateTime]::UtcNow.ToString('yyyyMMddHHmmss')
$snapshotId = "$DbInstanceIdentifier-pre-$normalizedRelease-$timestamp"
if ($snapshotId.Length -gt 255) {
  $snapshotId = $snapshotId.Substring(0, 255).TrimEnd('-')
}

& aws rds create-db-snapshot `
  --db-instance-identifier $DbInstanceIdentifier `
  --db-snapshot-identifier $snapshotId `
  --tags "Key=ReleaseRef,Value=$ReleaseRef" "Key=Purpose,Value=pre-migration" `
  --output json | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'RDS snapshot creation failed.' }

& aws rds wait db-snapshot-available --db-snapshot-identifier $snapshotId
if ($LASTEXITCODE -ne 0) { throw 'RDS snapshot did not become available.' }

$status = & aws rds describe-db-snapshots `
  --db-snapshot-identifier $snapshotId `
  --query 'DBSnapshots[0].Status' `
  --output text
if ($LASTEXITCODE -ne 0 -or $status -ne 'available') {
  throw "RDS snapshot status is '$status', expected 'available'."
}

if ($env:GITHUB_OUTPUT) {
  "snapshot_id=$snapshotId" | Out-File -FilePath $env:GITHUB_OUTPUT -Append -Encoding utf8
}
Write-Output "RDS pre-migration snapshot available: $snapshotId"

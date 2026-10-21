param(
  [Parameter(Mandatory=$true)][string]$StackName,
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $outputs = & (Join-Path $PSScriptRoot 'configure-cloud.ps1') -StackName $StackName -Region $Region
  npm run build:cloud
  if ($LASTEXITCODE -ne 0) { throw 'Cloud frontend build failed.' }
  New-Item -ItemType Directory -Force .deployment | Out-Null
  $archive = Join-Path $projectRoot '.deployment/frontend.zip'
  & (Join-Path $PSScriptRoot 'package-frontend.ps1') -ArchivePath $archive
  $raw = aws amplify create-deployment --app-id $outputs['AmplifyAppId'] --branch-name main --region $Region --output json
  if ($LASTEXITCODE -ne 0) { throw 'Unable to create Amplify deployment.' }
  $deployment = $raw | ConvertFrom-Json
  # The signed upload URL is kept in memory; it must never be logged or committed.
  try { Invoke-WebRequest -Uri $deployment.zipUploadUrl -Method Put -InFile $archive -ContentType 'application/zip' -UseBasicParsing | Out-Null }
  catch { throw 'Amplify artifact upload failed. Create a new deployment and retry.' }
  aws amplify start-deployment --app-id $outputs['AmplifyAppId'] --branch-name main --job-id $deployment.jobId --region $Region --query 'jobSummary.{Job:jobId,Status:status}' --output json
  if ($LASTEXITCODE -ne 0) { throw 'Unable to start Amplify deployment.' }
  $status = 'PENDING'
  $attempt = 0
  while ($status -in @('PENDING','PROVISIONING','RUNNING') -and $attempt -lt 120) {
    Start-Sleep -Seconds 5
    $status = aws amplify get-job --app-id $outputs['AmplifyAppId'] --branch-name main --job-id $deployment.jobId --region $Region --query job.summary.status --output text
    if ($LASTEXITCODE -ne 0) { throw 'Unable to read Amplify deployment status.' }
    $attempt++
  }
  if ($status -ne 'SUCCEED') { throw "Amplify deployment did not succeed: $status" }
  node (Join-Path $PSScriptRoot 'verify-hosting.mjs') $outputs['FrontendUrl']
  if ($LASTEXITCODE -ne 0) { throw 'The deployment completed but hosted asset verification failed.' }
  Write-Host "Verified frontend: $($outputs['FrontendUrl'])"
} finally { Pop-Location }

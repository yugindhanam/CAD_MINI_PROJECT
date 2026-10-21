param(
  [Parameter(Mandatory=$true)][string]$StackName,
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $raw = aws cloudformation describe-stacks --stack-name $StackName --region $Region --query 'Stacks[0].Outputs' --output json
  if ($LASTEXITCODE -ne 0) { throw "Unable to read stack outputs." }
  $outputs = @{}
  ($raw | ConvertFrom-Json) | ForEach-Object { $outputs[$_.OutputKey] = $_.OutputValue }
  foreach ($name in @('ApiUrl','UserPoolId','UserPoolClientId','CampusEmailDomain','AmplifyAppId','FrontendUrl')) {
    if (-not $outputs[$name]) { throw "Missing stack output: $name" }
  }
  $content = @(
    'VITE_MODE=aws',
    "VITE_CAMPUS_DOMAIN=$($outputs['CampusEmailDomain'])",
    "VITE_API_URL=$($outputs['ApiUrl'])",
    "VITE_USER_POOL_ID=$($outputs['UserPoolId'])",
    "VITE_USER_POOL_CLIENT_ID=$($outputs['UserPoolClientId'])"
  ) -join "`n"
  [System.IO.File]::WriteAllText((Join-Path $projectRoot '.env.aws.local'), $content + "`n")
  Write-Host "Cloud configuration written to ignored .env.aws.local. No credentials are included."
  Write-Host "Frontend: $($outputs['FrontendUrl'])"
  return $outputs
} finally { Pop-Location }

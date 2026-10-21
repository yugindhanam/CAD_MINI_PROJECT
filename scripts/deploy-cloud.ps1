param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')][string]$CampusDomain,
  [string]$StackName = "campus-find",
  [string]$Region = "ap-south-1"
)
$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
try {
  $env:PATH = (Join-Path $projectRoot 'node_modules\.bin') + ';' + $env:PATH
  $env:SAM_CLI_TELEMETRY = '0'
  $sam = Get-Command sam -ErrorAction SilentlyContinue
  if ($sam) { $samCommand = $sam.Source; $samPrefix = @() }
  elseif (Test-Path '.tools/sam-python/samcli') {
    $env:PYTHONPATH = Join-Path $projectRoot '.tools/sam-python'
    $samCommand = (Get-Command python).Source
    $samPrefix = @('-m','samcli')
  } else { throw 'Install the AWS SAM CLI before deployment.' }
  aws sts get-caller-identity --query Arn --output text --region $Region
  if ($LASTEXITCODE -ne 0) { throw 'AWS authentication failed.' }
  npm test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed.' }
  & $samCommand @samPrefix validate --lint --region $Region
  if ($LASTEXITCODE -ne 0) { throw 'SAM validation failed.' }
  & $samCommand @samPrefix build --cached --parallel
  if ($LASTEXITCODE -ne 0) { throw 'SAM build failed.' }
  & $samCommand @samPrefix deploy --stack-name $StackName --region $Region --resolve-s3 --capabilities CAPABILITY_IAM --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides "CampusDomain=$($CampusDomain.ToLowerInvariant())"
  if ($LASTEXITCODE -ne 0) { throw 'SAM deployment failed.' }
  & (Join-Path $PSScriptRoot 'publish-frontend.ps1') -StackName $StackName -Region $Region
} finally { Pop-Location }

param(
  [string]$Namespace = $env:DOCKERHUB_NAMESPACE,
  [string]$Tag = $(if ($env:IMAGE_TAG) { $env:IMAGE_TAG } else { "1.0.0" }),
  [switch]$SkipPush
)

if (-not $Namespace) {
  Write-Error "Set DOCKERHUB_NAMESPACE or pass -Namespace your-dockerhub-username."
  exit 1
}

$components = @(
  @{ Name = "frontend"; Dockerfile = "frontend/Dockerfile" },
  @{ Name = "gateway"; Dockerfile = "gateway/Dockerfile" },
  @{ Name = "auth"; Dockerfile = "services/auth/Dockerfile" },
  @{ Name = "profile"; Dockerfile = "services/profile/Dockerfile" },
  @{ Name = "accounts"; Dockerfile = "services/accounts/Dockerfile" },
  @{ Name = "balancer"; Dockerfile = "services/balancer/Dockerfile" },
  @{ Name = "notifications"; Dockerfile = "services/notifications/Dockerfile" },
  @{ Name = "deposits"; Dockerfile = "services/deposits/Dockerfile" },
  @{ Name = "transfers"; Dockerfile = "services/transfers/Dockerfile" },
  @{ Name = "analytics"; Dockerfile = "services/analytics/Dockerfile" },
  @{ Name = "ai"; Dockerfile = "services/ai/Dockerfile" },
  @{ Name = "admin"; Dockerfile = "services/admin/Dockerfile" }
)

foreach ($component in $components) {
  $image = "$Namespace/liontech-finance-$($component.Name):$Tag"
  Write-Host "Building $image"
  docker build -f $component.Dockerfile -t $image .

  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  if (-not $SkipPush) {
    Write-Host "Pushing $image"
    docker push $image

    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  }
}

Write-Host "LionTech Finance images are ready."

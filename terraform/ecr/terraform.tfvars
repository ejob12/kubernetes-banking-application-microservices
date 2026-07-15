# ECR Configuration
aws_region = "us-east-1"
environment = "dev"

# Service names match the microservices in docker-compose.yml
service_names = [
  "frontend",
  "gateway",
  "auth",
  "profile",
  "accounts",
  "balancer",
  "notifications",
  "deposits",
  "transfers",
  "analytics",
  "ai",
  "admin"
]

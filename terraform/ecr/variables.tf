variable "aws_region" {
  description = "AWS region where ECR repositories will be created"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "service_names" {
  description = "List of microservices to create ECR repositories for"
  type        = list(string)
  default = [
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
}

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "liontech-finance"
      ManagedBy   = "Terraform"
    }
  }
}

# Create ECR Repository
resource "aws_ecr_repository" "liontech_finance" {
  for_each = toset(var.service_names)

  repository_name            = "liontech-finance-${each.value}"
  image_tag_mutability       = "MUTABLE"
  force_delete               = true
  scan_on_push               = true
  image_scanning_enabled     = true

  tags = {
    Name = "liontech-finance-${each.value}"
  }
}

# Create ECR Lifecycle Policy to cleanup old images
resource "aws_ecr_lifecycle_policy" "cleanup" {
  for_each = aws_ecr_repository.liontech_finance

  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep last 10 images"
        selection = {
          tagStatus     = "any"
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

# Output repository URLs
output "ecr_repositories" {
  description = "Map of ECR repository names to their URLs"
  value = {
    for service, repo in aws_ecr_repository.liontech_finance :
    service => {
      repository_url = repo.repository_url
      registry_id    = repo.registry_id
      repository_arn = repo.arn
    }
  }
}

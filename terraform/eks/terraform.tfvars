# EKS Configuration
aws_region         = "us-east-1"
environment        = "dev"
cluster_name       = "liontech-finance-eks"
kubernetes_version = "1.28"

# Network Configuration
vpc_cidr = "10.0.0.0/16"

# Node Configuration
node_instance_type = "t3.medium"
node_desired_size  = 2
node_min_size      = 1
node_max_size      = 4

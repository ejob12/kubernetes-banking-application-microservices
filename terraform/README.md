# LionTech Finance - AWS Infrastructure as Code

This directory contains Terraform configurations to deploy AWS infrastructure for the LionTech Finance microservices banking application.

## Directory Structure

```
terraform/
├── ecr/              # AWS ECR (Elastic Container Registry) configuration
│   ├── main.tf       # ECR repositories for all microservices
│   ├── variables.tf  # Input variables
│   └── terraform.tfvars  # Variable values
│
├── eks/              # AWS EKS (Elastic Kubernetes Service) configuration
│   ├── main.tf       # EKS cluster, VPC, subnets, security groups
│   ├── variables.tf  # Input variables
│   └── terraform.tfvars  # Variable values
│
└── README.md         # This file
```

## Prerequisites

1. **AWS Account**: You need an active AWS account
2. **Terraform**: Install version >= 1.0
3. **AWS CLI**: Version >= 2.0 for configuring kubectl
4. **kubectl**: For interacting with the Kubernetes cluster
5. **IAM Permissions**: User/role with permissions to create:
   - VPC, Subnets, Internet Gateway, NAT Gateway, Route Tables
   - EKS Cluster and Node Groups
   - ECR Repositories
   - IAM Roles and Policies
   - Security Groups
   - EC2 instances (for node group)

## Setup Instructions

### Step 1: Initialize Terraform for ECR

```bash
cd terraform/ecr
terraform init
```

### Step 2: Plan ECR Deployment

```bash
terraform plan
```

Review the output to ensure the right resources will be created.

### Step 3: Apply ECR Configuration

```bash
terraform apply
```

Confirm by typing `yes` when prompted. Save the output showing ECR repository URLs.

### Step 4: Initialize Terraform for EKS

```bash
cd ../eks
terraform init
```

### Step 5: Plan EKS Deployment

```bash
terraform plan
```

This will take a moment and show all VPC and EKS resources to be created.

### Step 6: Apply EKS Configuration

```bash
terraform apply
```

Confirm by typing `yes`. This step takes 10-15 minutes as it creates the EKS cluster.

### Step 7: Configure kubectl

After EKS deployment completes, configure kubectl to access the cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name liontech-finance-eks
```

Verify access:

```bash
kubectl get nodes
```

You should see your 2 worker nodes listed.

## Important Files

### ECR Configuration

- **ecr/main.tf**: Creates 12 ECR repositories (one for each microservice)
- **ecr/variables.tf**: Defines reusable variables
- **ecr/terraform.tfvars**: Sets variable values for your environment

### EKS Configuration

- **eks/main.tf**: Creates:
  - VPC with 2 public and 2 private subnets across 2 AZs
  - Internet Gateway and NAT Gateway for routing
  - Security groups for control plane and nodes
  - IAM roles for cluster and node group
  - EKS cluster (Kubernetes 1.28)
  - 2 worker nodes (t3.medium, scalable to 4)

- **eks/variables.tf**: Configurable parameters
- **eks/terraform.tfvars**: Environment-specific values

## Customization

### Change AWS Region

Edit both `ecr/terraform.tfvars` and `eks/terraform.tfvars`:

```hcl
aws_region = "eu-west-1"  # Change to your desired region
```

### Scale Node Count

Edit `eks/terraform.tfvars`:

```hcl
node_desired_size = 3  # Increase desired nodes
node_max_size     = 5  # Increase maximum scaling limit
```

### Change Instance Type

Edit `eks/terraform.tfvars`:

```hcl
node_instance_type = "t3.large"  # More powerful nodes
```

## Cost Estimation

Example monthly costs (us-east-1):
- **EKS Control Plane**: ~$73
- **2x t3.medium EC2 Nodes**: ~$60
- **ECR Repositories**: ~$1 per repository per month
- **Data Transfer**: Varies based on usage

**Total Estimate**: ~$200-300/month for dev environment

## Destroying Resources

When you no longer need the infrastructure:

```bash
# Destroy EKS first (takes ~10 minutes)
cd terraform/eks
terraform destroy

# Then destroy ECR
cd ../ecr
terraform destroy
```

**Warning**: This will delete all resources and data. Make sure to back up any important data first.

## Troubleshooting

### Error: "Provider configuration not present"

Make sure you've set AWS credentials:

```bash
aws configure
```

### Error: "Insufficient IAM permissions"

Verify your IAM user has the required permissions for EKS, VPC, and ECR.

### kubectl: "Unable to connect to server"

Reconfigure kubectl with the correct cluster:

```bash
aws eks update-kubeconfig --region us-east-1 --name liontech-finance-eks
```

## Next Steps

1. Push Docker images to ECR repositories
2. Update Kubernetes manifests with ECR repository URLs
3. Deploy LionTech Finance application to EKS
4. Configure Jenkins pipeline to automate deployment

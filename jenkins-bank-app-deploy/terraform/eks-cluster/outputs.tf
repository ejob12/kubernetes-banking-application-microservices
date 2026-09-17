output "cluster_name" {
  value = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  value = aws_eks_cluster.this.endpoint
}

output "cluster_certificate_authority" {
  value = aws_eks_cluster.this.certificate_authority[0].data
}

output "node_group_name" {
  value = aws_eks_node_group.this.node_group_name
}

output "autoscaling_group_name" {
  value = aws_eks_node_group.this.resources[0].autoscaling_groups[0].name
}

output "vpc_id" {
  value = aws_vpc.eks.id
}

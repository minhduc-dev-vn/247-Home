output "application_log_group_name" {
  value = var.application_log_group_name
}

output "alarm_topic_arn" {
  value = var.create_alarms ? aws_sns_topic.alarms[0].arn : null
}

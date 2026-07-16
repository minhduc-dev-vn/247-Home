resource "aws_cloudwatch_log_group" "application" {
  count = var.create_application_log_group ? 1 : 0

  name              = var.application_log_group_name
  retention_in_days = var.log_retention_days
  kms_key_id        = var.logs_kms_key_arn
  tags              = var.tags
}

resource "aws_sns_topic" "alarms" {
  count = var.create_alarms ? 1 : 0

  name              = "${var.name}-alarms"
  kms_master_key_id = "alias/aws/sns"
  tags              = var.tags
}

resource "aws_sns_topic_subscription" "email" {
  count = var.create_alarms && var.alarm_email != null ? 1 : 0

  topic_arn = aws_sns_topic.alarms[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

locals {
  alarm_actions = var.create_alarms ? [aws_sns_topic.alarms[0].arn] : []
}

resource "aws_cloudwatch_metric_alarm" "ecs_cpu" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-ecs-high-cpu"
  namespace           = "AWS/ECS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
  alarm_actions = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_memory" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-ecs-high-memory"
  namespace           = "AWS/ECS"
  metric_name         = "MemoryUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
  alarm_actions = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_metric_alarm" "ecs_running_tasks" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-ecs-task-count-low"
  namespace           = "ECS/ContainerInsights"
  metric_name         = "RunningTaskCount"
  statistic           = "Average"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = var.ecs_minimum_task_count
  treat_missing_data  = "breaching"
  dimensions = {
    ClusterName = var.ecs_cluster_name
    ServiceName = var.ecs_service_name
  }
  alarm_actions = local.alarm_actions
  tags          = var.tags
}

resource "aws_cloudwatch_event_rule" "ecs_stopped_task" {
  count = var.create_alarms && var.ecs_cluster_arn != null ? 1 : 0

  name        = "${var.name}-ecs-stopped-task"
  description = "Notify on stopped 247 Home ECS tasks"
  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn    = [var.ecs_cluster_arn]
      lastStatus    = ["STOPPED"]
      desiredStatus = ["STOPPED"]
    }
  })
  tags = var.tags
}

resource "aws_cloudwatch_event_target" "ecs_stopped_task" {
  count = var.create_alarms && var.ecs_cluster_arn != null ? 1 : 0

  rule = aws_cloudwatch_event_rule.ecs_stopped_task[0].name
  arn  = aws_sns_topic.alarms[0].arn
}

data "aws_iam_policy_document" "sns_events" {
  count = var.create_alarms && var.ecs_cluster_arn != null ? 1 : 0

  statement {
    actions   = ["sns:Publish"]
    resources = [aws_sns_topic.alarms[0].arn]

    principals {
      type        = "Service"
      identifiers = ["events.amazonaws.com"]
    }

    condition {
      test     = "ArnEquals"
      variable = "aws:SourceArn"
      values   = [aws_cloudwatch_event_rule.ecs_stopped_task[0].arn]
    }
  }
}

resource "aws_sns_topic_policy" "events" {
  count = var.create_alarms && var.ecs_cluster_arn != null ? 1 : 0

  arn    = aws_sns_topic.alarms[0].arn
  policy = data.aws_iam_policy_document.sns_events[0].json
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-high-cpu"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = var.rds_identifier }
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-connections-high"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 80
  treat_missing_data  = "notBreaching"
  dimensions          = { DBInstanceIdentifier = var.rds_identifier }
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "rds_storage" {
  count = var.create_alarms ? 1 : 0

  alarm_name          = "${var.name}-rds-free-storage-low"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "LessThanThreshold"
  threshold           = var.rds_allocated_storage_gib * 1024 * 1024 * 1024 * 0.2
  treat_missing_data  = "breaching"
  dimensions          = { DBInstanceIdentifier = var.rds_identifier }
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count = var.create_alarms && var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.name}-alb-5xx"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 60
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

resource "aws_cloudwatch_metric_alarm" "alb_latency" {
  count = var.create_alarms && var.alb_arn_suffix != null ? 1 : 0

  alarm_name          = "${var.name}-alb-p95-latency"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p95"
  period              = 300
  evaluation_periods  = 2
  comparison_operator = "GreaterThanThreshold"
  threshold           = 2
  treat_missing_data  = "notBreaching"
  dimensions          = { LoadBalancer = var.alb_arn_suffix }
  alarm_actions       = local.alarm_actions
  tags                = var.tags
}

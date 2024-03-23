terraform {
  required_providers {
    aws = {
        source = "hashicorp/aws"
        version = "~> 5.42.0"
    }
  }
}

provider "aws" {
  region = "eu-west-2"
}

resource "aws_sqs_queue" "data_queue" {
  name = "reddit-scraper-queue"
  visibility_timeout_seconds = 30

  tags = {
    Project = "reddit-scraper",
    CreatedBy = "Terraform"
  }
}
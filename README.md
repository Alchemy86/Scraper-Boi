# Your Project Name

Short description or introduction to your project.

## Table of Contents

- [Introduction](#introduction)
- [Installation](#installation)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Introduction

Basic web scraper example application making use of 
 - Playwright
 - NodeJS
 - Typescrip
 - AWS
 - Terraform
 - SQS

 Takes the example subreddit page, grabs all posts from the last 24 hours. Runs playwright in parallel to get the post details and then pushes the data to SQS on AWS for processing.

## Installation

Instructions for installing your project. Include any prerequisites, dependencies, or setup steps needed to run the project. For example:

```bash
npm install
```

The queue can be setup using the terrafrom project.
Register you machine with access to your AWS account and within the infrastructure folder:

```bash
terraform init
terraform plan
terraform apply
```
You can get your URL from the settings once you confirm you have your queue:

-https://eu-west-2.console.aws.amazon.com/sqs/v3/home?region=eu-west-2#/queues

You will then need to set your queue url to the environment variable

```
export QUEUE_URL=<QUEUE_URL_REPLACE_ME>     
```

Within the scraper folder

```bash
tsc
node index.js
```

This will then run.
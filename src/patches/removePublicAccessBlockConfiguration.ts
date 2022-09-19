/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IAspect } from 'aws-cdk-lib';
import { Bucket, CfnBucket } from 'aws-cdk-lib/aws-s3';
import { IConstruct } from 'constructs';

/**
 * Looks for S3 Buckets, and removes the `PublicAccessBlockConfiguration` property.
 *
 * For use in regions where Cloudformation doesn't support this property
 */
export class RemovePublicAccessBlockConfiguration implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof Bucket) {
      const cfnBucket = node.node.defaultChild as CfnBucket;
      cfnBucket.addPropertyDeletionOverride('PublicAccessBlockConfiguration');
    }
  }
}

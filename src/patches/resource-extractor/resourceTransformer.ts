/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Aws } from 'aws-cdk-lib';
import { CfnApiKey } from 'aws-cdk-lib/aws-apigateway';
import { CfnTable } from 'aws-cdk-lib/aws-dynamodb';
import { CfnCluster, CfnService, CfnTaskDefinition } from 'aws-cdk-lib/aws-ecs';
import { CfnDomain as CfnDomainEss } from 'aws-cdk-lib/aws-elasticsearch';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
import { CfnLogGroup } from 'aws-cdk-lib/aws-logs';
import { CfnDomain as CfnDomainOss } from 'aws-cdk-lib/aws-opensearchservice';
import { CfnBucket } from 'aws-cdk-lib/aws-s3';
import { CfnTopic } from 'aws-cdk-lib/aws-sns';
import { CfnQueue } from 'aws-cdk-lib/aws-sqs';
import { CfnParameter } from 'aws-cdk-lib/aws-ssm';
import { CfnStateMachine } from 'aws-cdk-lib/aws-stepfunctions';
import { CfnAlarm } from 'aws-cdk-lib/aws-cloudwatch';
import { CfnStore } from './cfnStore';
import { FlatJson, Json } from './types';

type Transformer = (
  stackName: string,
  logicalId: string,
  resourceProperties: Json
) => string;

export class MissingTransformError extends Error {
  constructor(resourceType: string) {
    super(`
    Unable to find transform for resource type: ${resourceType}.
    You can provide an additional transformation to the Aspect to resolve
    this and/or open a GitHub Issue to get the resource transformation
    added at https://github.com/cdklabs/cdk-enterprise-iac/issues.
    `);
  }
}

export enum ResourceTransform {
  STACK_NAME = 'ResourceTransform.STACK_NAME',
  LOGICAL_ID = 'ResourceTransform.LOGICAL_ID',
}

export interface ResourceTransformerProps {
  readonly cfnStore: CfnStore;
  readonly additionalTransforms?: FlatJson;
}

export class ResourceTransformer {
  private readonly cfn: CfnStore;
  private readonly defaultTransforms: { [key: string]: Transformer };
  private readonly additionalTransforms?: FlatJson;

  constructor(props: ResourceTransformerProps) {
    this.cfn = props.cfnStore;
    this.defaultTransforms = this.createDefaultTransforms();
    this.additionalTransforms = props.additionalTransforms;
  }

  /**
   * Helper function that generates the beginning portion of an AWS Arn.
   */
  private generateArnPreamble(
    service: string,
    includeRegion: boolean = true,
    includeAccount: boolean = true
  ): string {
    const region = includeRegion ? `${Aws.REGION}` : '';
    const account = includeAccount ? `${Aws.ACCOUNT_ID}` : '';

    return `arn:${Aws.PARTITION}:${service}:${region}:${account}`;
  }

  /**
   * Creates the Default Transformation function table that contains transform
   * functions for each CloudFormation Resource Type.
   *
   * This should be updated to support additional resource types.
   * In addition, it may need to be fixed if some of the transformations are
   * found to be incorrect or inconsistent.
   *
   * @returns object in the form of { 'AWS::S3::Bucket': transform function }
   */
  private createDefaultTransforms(): { [key: string]: Transformer } {
    return {
      /** Standard */
      [CfnTable.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*`;
        const preamble = this.generateArnPreamble('dynamodb');
        return `${preamble}:table/${partial}`;
      },
      [CfnDomainEss.CFN_RESOURCE_TYPE_NAME]: (
        _,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${logicalId.substring(0, 15).toLowerCase()}*`;
        const preamble = this.generateArnPreamble('es');
        return `${preamble}:domain/${partial}`;
      },
      [CfnDomainOss.CFN_RESOURCE_TYPE_NAME]: (
        _,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${logicalId.substring(0, 15).toLowerCase()}*`;
        const preamble = this.generateArnPreamble('es');
        return `${preamble}:domain/${partial}`;
      },
      [CfnTaskDefinition.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}${logicalId}*:*`.replace('-', '');
        const preamble = this.generateArnPreamble('ecs');
        return `${preamble}:task-definition/${partial}`;
      },
      [CfnCluster.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*`;
        const preamble = this.generateArnPreamble('ecs');
        return `${preamble}:cluster/${partial}`;
      },
      [CfnService.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `*/${stackName}-${logicalId}*`
        const preamble = this.generateArnPreamble('ecs');
        return `${preamble}:service/${partial}`
      },
      /** Colon-resource name grouping */
      [CfnLogGroup.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*:*`;
        const preamble = this.generateArnPreamble('logs');
        return `${preamble}:log-group:${partial}`;
      },
      [CfnFunction.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}`.substring(0, 50) + '*';
        const preamble = this.generateArnPreamble('lambda');
        return `${preamble}:function:${partial}`;
      },
      [CfnStateMachine.CFN_RESOURCE_TYPE_NAME]: (
        _,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${logicalId}*`;
        const preamble = this.generateArnPreamble('states');
        return `${preamble}:stateMachine:${partial}`;
      },
      [CfnAlarm.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*`;
        const preamble = this.generateArnPreamble('cloudwatch');
        return `${preamble}:alarm:${partial}`
      },
      /** No resource name grouping */
      [CfnQueue.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*`;
        const preamble = this.generateArnPreamble('sqs');
        return `${preamble}:${partial}`;
      },
      [CfnBucket.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        resourceProperties
      ) => {
        let partial: string;
        if (
          resourceProperties !== undefined &&
          'BucketName' in resourceProperties
        ) {
          partial = `${resourceProperties.BucketName}*`;
        } else {
          partial = `${stackName}-${logicalId}*`.toLowerCase();
        }
        const preamble = this.generateArnPreamble('s3', false, false);
        return `${preamble}:${partial}`;
      },
      [CfnTopic.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName}-${logicalId}*`;
        const preamble = this.generateArnPreamble('sns');
        return `${preamble}:${partial}`;
      },
      /** Non-standard */
      [CfnParameter.CFN_RESOURCE_TYPE_NAME]: (
        _,
        logicalId,
        resourceProperties
      ) => {
        if ('Name' in resourceProperties) {
          return resourceProperties.Name;
        }
        const partial = `CFN-${logicalId}*`;
        return partial;
      },
      [CfnApiKey.CFN_RESOURCE_TYPE_NAME]: (
        stackName,
        logicalId,
        _resourceProperties
      ) => {
        const partial = `${stackName.substring(0, 6)}-${logicalId.substring(
          0,
          5
        )}*`;
        return partial;
      },
    };
  }

  /**
   * Transforms resource names to partial values (primarily ARNs) using
   * wildcards.
   *
   * Takes in a generated resource name from CDK and transforms it to a
   * partial value that is used to replace resource references that use
   * `Fn::GetAtt` from the generated resource name. This is mainly used to
   * avoid cyclical dependencies within CDK and ensure that Policies can be
   * correctly created without knowing the future value of a resource. This
   * relies on the assumption that the developer does NOT input the `name`
   * of the resource they are creating. In other words, you must let CDK
   * generate the resource name.
   *
   * @param logicalId the Logical ID of the Resource generated by CDK
   * @returns string of partial match value to use in IAM Policies
   */
  public toPartial(logicalId: string) {
    const stackName = this.cfn.getStackNameFromLogicalId(logicalId);
    const resourceType = this.cfn.getResourceTypeFromLogicalId(logicalId);
    const resourceProperties = this.cfn.getResourcePropertiesFromLogicalId(
      stackName,
      logicalId
    );

    if (
      this.additionalTransforms &&
      resourceType in this.additionalTransforms
    ) {
      return this.additionalTransforms[resourceType]
        .replace(ResourceTransform.STACK_NAME, stackName)
        .replace(ResourceTransform.LOGICAL_ID, logicalId);
    } else if (resourceType in this.defaultTransforms) {
      const transformResourceToPartial = this.defaultTransforms[resourceType];
      return transformResourceToPartial(
        stackName,
        logicalId,
        resourceProperties
      );
    } else {
      throw new MissingTransformError(resourceType);
    }
  }
}

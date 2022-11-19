/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import * as cp from 'child_process';
import { CfnResource } from 'aws-cdk-lib';
import { CloudFormationStackArtifact } from 'aws-cdk-lib/cx-api';
import { CloudFormation } from 'aws-sdk';
import { Flattener } from './flattener';
import { ResourceExtractorShareMethod } from './resourceExtractor';
import { FlatJson, Json } from './types';

export interface CfnStoreProps {
  readonly stackArtifacts: CloudFormationStackArtifact[];
  readonly valueShareMethod: ResourceExtractorShareMethod;
  readonly extractedStackName: string;
  readonly region: string;
}

export class CfnStore {
  public readonly templates: Json = {};
  public readonly flatTemplates: FlatJson;
  public readonly extractedStackExports: FlatJson = {};
  public readonly trackedExports: Json = {};

  constructor(props: CfnStoreProps) {
    /** Save CloudFormation templates for future lookup */
    for (const item of props.stackArtifacts) {
      this.templates[item.stackName] = item.template;
    }
    this.flatTemplates = Flattener.flattenObject(this.templates);

    /** Save Value Map if we are using the `API_LOOKUP` sharing method */
    if (props.valueShareMethod == ResourceExtractorShareMethod.API_LOOKUP) {
      const stack = this.describeStack(props.extractedStackName, props.region);
      if (stack) {
        this.extractedStackExports = this.createExportMap(stack);
      }
    }
    // if (props.valueShareMethod == ResourceExtractorShareMethod.CFN_OUTPUT) {
    //   this.trackedExports = {}
    // }
  }

  /**
   * Determine what the export value should be, for example if it should be a
   * `Ref` or `Fn::GetAtt`
   *
   * @param resource
   * @param flattendKey
   * @returns
   */
  public determineExportValue(resource: CfnResource, flattendKey: string) {
    const splitKey = flattendKey.split('.');

    if (splitKey.slice(-1)[0] == 'Ref') {
      return resource.ref;
    } else if (splitKey.slice(-2)[0] == 'Fn::GetAtt') {
      const attToGet = Flattener.getValueByPath(
        this.templates,
        splitKey.slice(0, -1).concat(['1']).join('.')
      );
      return resource.getAtt(attToGet);
    } else if (splitKey.slice(-2)[0] == 'DependsOn') {
      return false;
    } else if (splitKey.slice(-1)[0] == 'Fn::ImportValue') {
      // CDK has already configured the proper Export/Imports
      // Work backwards to determine what this should be overwritten to
      const originalImportWithoutStack =
        this.flatTemplates[flattendKey].split(':')[1];
      for (let exported of Object.values(this.trackedExports)) {
        if (
          exported['Fn::ImportValue'].split(':')[1] ==
          originalImportWithoutStack
        ) {
          return { preExported: exported };
        }
      }

      throw new Error(
        `Can't determine export value for ${flattendKey}. Looking for ${this.flatTemplates[flattendKey]}`
      );
    } else {
      throw new Error(`Can't determine export value for ${flattendKey}`);
    }
  }

  /**
   * Retrieve a Stack Name from a given Logical ID
   *
   * @param logicalId the Logical ID of the Resource to find
   * @returns the Stack Name that the Logical ID is found to be in
   */
  public getStackNameFromLogicalId(logicalId: string): string {
    const stackTypeKey = Object.keys(this.flatTemplates).filter(
      (key) => key.indexOf(`${logicalId}.Type`) > -1
    )[0];
    const stackName = stackTypeKey.split('.')[0];
    return stackName;
  }

  /**
   * Retrieve a Resource Type from a given Logical ID
   *
   * @param logicalId the logical ID of the Resource to find
   * @returns the Resource Type of the provided Logical ID
   */
  public getResourceTypeFromLogicalId(logicalId: string): string {
    const typeKey = Object.keys(this.flatTemplates).filter(
      (key) => key.indexOf(`${logicalId}.Type`) > -1
    )[0];

    const resourceType = this.flatTemplates[typeKey];
    return resourceType;
  }

  /**
   * Performs a Describe Stack API call with the AWS SDK to determine what
   * the CloudFormation Exports are for a given Stack Name.
   *
   * @param stackName the CloudFormation stack name to query against
   * @param region the AWS region to target
   * @returns CloudFormation Stack object
   */
  private describeStack(
    stackName: string,
    region: string
  ): CloudFormation.Stack | undefined {
    let stack: CloudFormation.Stack | undefined;
    try {
      const output = cp.spawnSync(
        'node',
        [
          '-e',
          `
            const sdk = require('aws-sdk');
            const cfn = new sdk.CloudFormation({
              apiVersion: '2016-11-15',
              region: '${region}'
            });
            cfn.describeStacks({StackName: '${stackName}'})
                .promise()
                .then((data) => {
                  const j = JSON.stringify(data);
                  console.log(j);
                }
            );
          `,
        ],
        { encoding: 'utf8' }
      );
      const response = JSON.parse(output.stdout);
      const stacks: CloudFormation.Stack[] = response.Stacks;

      stack = stacks[0];
    } catch {}

    return stack;
  }

  /**
   * Builds an Export lookup table from the provided AWS SDK CloudFormation
   * stack object. This will be in the form of `{ 'MyExport': 'foobar' }`.
   *
   * @param stack
   * @returns
   */
  private createExportMap(stack: CloudFormation.Stack): FlatJson {
    const exports: FlatJson = {};
    const outputs = stack.Outputs ?? [];
    for (const output of outputs) {
      if (output.ExportName && output.OutputValue) {
        exports[output.ExportName] = output.OutputValue;
      }
    }
    return exports;
  }
}

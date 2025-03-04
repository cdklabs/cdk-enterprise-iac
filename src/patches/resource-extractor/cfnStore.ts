/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import * as cp from 'child_process';
import type { Stack } from '@aws-sdk/client-cloudformation';
import { CfnResource, Fn } from 'aws-cdk-lib';
import { CloudFormationStackArtifact } from 'aws-cdk-lib/cx-api';
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
  public readonly fnJoins: Json = {};

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
   *
   * @param stackName Stack name
   * @param logicalId the logical ID of the Resource to find
   * @returns Json object of the Cloudformation resource properties
   */
  public getResourcePropertiesFromLogicalId(
    stackName: string,
    logicalId: string
  ): Json {
    return this.templates[stackName].Resources[logicalId].Properties;
  }

  /**
   * Performs a Describe Stack API call with the AWS SDK to determine what
   * the CloudFormation Exports are for a given Stack Name.
   *
   * @param stackName the CloudFormation stack name to query against
   * @param region the AWS region to target
   * @returns CloudFormation Stack object
   */
  private describeStack(stackName: string, region: string): Stack | undefined {
    let stack: Stack | undefined;
    try {
      const output = cp.spawnSync(
        'aws',
        [
          'cloudformation',
          'describe-stacks',
          '--stack-name',
          stackName,
          '--region',
          region,
          '--output',
          'json',
        ],
        { encoding: 'utf8' }
      );

      if (output.status !== 0) {
        return undefined;
      }

      const response = JSON.parse(output.stdout);
      const stacks: Stack[] = response.Stacks;

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
  private createExportMap(stack: Stack): FlatJson {
    const exports: FlatJson = {};
    const outputs = stack.Outputs ?? [];
    for (const output of outputs) {
      if (output.ExportName && output.OutputValue) {
        exports[output.ExportName] = output.OutputValue;
      }
    }
    return exports;
  }

  /**
   * Rebuilds an `Fn::Join` statement from the Flat Json path. This is
   * necessary because CDK does not correctly inject values back into
   * `Fn::Join` blocks. The rebuilt object is injected back into the spot where
   * the original `Fn::Join` was at. By using this method, we can get around
   * the problem where `addPropertyOverride` does not work for Fn::Join lists.
   *
   * @param fnJoinFlatJsonPath
   * @returns string of Fn::Join (may be string or Json string depending on
   * if CloudFormation needs to reference values or if the entire string can
   * be hardcoded back)
   */
  public rebuildFnJoin(fnJoinFlatJsonPath: string): string {
    // Find the items that this fnJoin references
    const items = Object.keys(this.flatTemplates).filter((key) =>
      key.includes(`${fnJoinFlatJsonPath}.1`)
    );

    // Sort the items so that they are rebuilt in the right order
    items.sort();

    // Get the actual values from the flat templates map
    const listOfValues: string[] = [];
    items.forEach((item) => {
      if (Object.keys(this.fnJoins).includes(item)) {
        listOfValues.push(this.fnJoins[item]);
      } else if (item.split('.').slice(-1)[0] == 'Ref') {
        listOfValues.push(Fn.ref(this.flatTemplates[item]));
      } else if (!item.includes('Fn::GetAtt.1')) {
        listOfValues.push(this.flatTemplates[item]);
      }
    });

    // Return the rebuilt Join statement
    return Fn.join(this.flatTemplates[`${fnJoinFlatJsonPath}.0`], listOfValues);
  }
}

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, IAspect, Stack, Token } from 'aws-cdk-lib';
import {
  CfnInstanceProfile,
  CfnManagedPolicy,
  CfnPolicy,
} from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { getResourceId } from '../utils/utils';
import {v4 as uuidv4} from 'uuid';

/**
 * Properties to pass to the AddPermissionBoundary
 *
 * @interface AddPermissionBoundaryProps
 *
 */
export interface AddPermissionBoundaryProps {
  /**
   * Name of Permissions Boundary Policy to add to all IAM roles
   */
  readonly permissionsBoundaryPolicyName: string;
  /**
   * A prefix to prepend to the name of IAM Roles (Default: '').
   */
  readonly rolePrefix?: string;
  /**
   * A prefix to prepend to the name of the IAM Policies and ManagedPolicies (Default: '').
   */
  readonly policyPrefix?: string;
  /**
   * A prefix to prepend to the name of the IAM InstanceProfiles (Default: '').
   */
  readonly instanceProfilePrefix?: string;
}

/**
 * A patch for Adding Permissions Boundaries to all IAM roles
 *
 * Additional options for adding prefixes to IAM role, policy and instance profile names
 *
 * Can account for non commercial partitions (e.g. aws-gov, aws-cn)
 */
export class AddPermissionBoundary implements IAspect {
  private _permissionsBoundaryPolicyName: string;
  private _rolePrefix: string;
  private _policyPrefix: string;
  private _instanceProfilePrefix: string;

  constructor(props: AddPermissionBoundaryProps) {
    this._permissionsBoundaryPolicyName = props.permissionsBoundaryPolicyName;
    this._rolePrefix = props.rolePrefix || '';
    this._policyPrefix = props.policyPrefix || '';
    this._instanceProfilePrefix = props.instanceProfilePrefix || '';
  }

  public checkAndOverride(
    node: CfnResource,
    prefix: string,
    length: number,
    cfnProp: string,
    cdkProp?: string
  ): void {
    if (!cdkProp?.startsWith(prefix)) {
      let policySuffix;
      if (cdkProp != undefined) {
        policySuffix = !Token.isUnresolved(cdkProp)
          ? (cdkProp as string)
          : getResourceId(node.node.path);
      } else if (cdkProp == undefined && prefix != '') {
        policySuffix = getResourceId(node.node.path);
      } else {
        return;
      }
      const uniqness_length = 8
      let suffix = `${policySuffix.replace(/\s/g, '')}`.substring(0, length - uniqness_length - prefix.length);
      let uuid = uuidv4();
      let charUniqness8 = uuid.substring( uuid.length - uniqness_length, uuid.length );
      let newSuffix = prefix + suffix + charUniqness8;
      node.addPropertyOverride(
        cfnProp,
        `${newSuffix}`.substring(0, length),
      );
    }
  }

  public visit(node: IConstruct): void {
    if (node instanceof CfnResource) {
      const cfnResourceNode: CfnResource = node;
      if (cfnResourceNode.cfnResourceType == 'AWS::IAM::Role') {
        const permissionsBoundaryPolicyArn = Stack.of(node).formatArn({
          service: 'iam',
          resource: 'policy',
          region: '',
          resourceName: this._permissionsBoundaryPolicyName,
        });
        node.addPropertyOverride(
          'PermissionsBoundary',
          permissionsBoundaryPolicyArn
        );
        const roleName =
          // eslint-disable-next-line dot-notation
          cfnResourceNode['cfnProperties'].roleName ||
          cfnResourceNode.logicalId;
        this.checkAndOverride(node, this._rolePrefix, 64, 'RoleName', roleName);
      }
    }
    if (node instanceof CfnPolicy) {
      this.checkAndOverride(
        node,
        this._policyPrefix,
        128,
        'PolicyName',
        node.policyName
      );
    } else if (node instanceof CfnManagedPolicy) {
      this.checkAndOverride(
        node,
        this._policyPrefix,
        128,
        'ManagedPolicyName',
        node.managedPolicyName
      );
    } else if (node instanceof CfnInstanceProfile) {
      this.checkAndOverride(
        node,
        this._instanceProfilePrefix,
        128,
        'InstanceProfileName',
        node.instanceProfileName
      );
    }
  }
}

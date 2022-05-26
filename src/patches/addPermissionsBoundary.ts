import { CfnResource, IAspect, Token } from 'aws-cdk-lib';
import { CfnInstanceProfile, CfnManagedPolicy, CfnPolicy, CfnRole } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { getResourceId } from '../utils/utils';

export interface AddPermissionBoundaryProps {
  /**
   * Name of Permissions Boundary to add to all IAM roles
   */
  readonly permissionsBoundaryPolicyName: string;
  /**
   * Name of Account
   */
  readonly account: string;
  /**
   * Name of Partition (Default: 'aws')
   */
  readonly partition?: string;
  /**
   * The prefix appended to the name of IAM Roles (Default: '').
   */
  readonly rolePrefix?: string;
  /**
   * The prefix appended to the name of the IAM Policies and ManagedPolicies (Default: '').
   */
  readonly policyPrefix?: string;
  /**
   * The prefix appended to the name of the IAM InstanceProfiles (Default: '').
   */
  readonly instanceProfilePrefix?: string;

}

export class AddPermissionBoundary implements IAspect {
  private _permissionsBoundaryPolicyName: string;
  private _account: string;
  private _partition: string;
  private _rolePrefix: string;
  private _policyPrefix: string;
  private _instanceProfilePrefix: string;
  private _permissionsBoundaryPolicyArn: string;

  constructor(props: AddPermissionBoundaryProps) {
    this._permissionsBoundaryPolicyName = props.permissionsBoundaryPolicyName;
    this._account = props.account;
    this._partition = props.partition || 'aws';
    this._rolePrefix = props.rolePrefix || '';
    this._policyPrefix = props.policyPrefix || '';
    this._instanceProfilePrefix = props.instanceProfilePrefix || '';

    this._permissionsBoundaryPolicyArn = `arn:${this._partition}:iam:${this._account}:policy/${this._permissionsBoundaryPolicyName}`;
  }

  public checkAndOverride(node: CfnResource, prefix: string, length: number, cfnProp: string, cdkProp?: string): void {
    if (!cdkProp?.startsWith(prefix)) {
      const policySuffix = !Token.isUnresolved(cdkProp) ? cdkProp : getResourceId(node.node.path);
      node.addPropertyOverride(cfnProp, `${prefix}${policySuffix}`.substring(0, length - 1));
    }
  }

  public visit(node: IConstruct): void {
    if (node instanceof CfnRole) {
      node.addPropertyOverride('PermissionsBoundary', this._permissionsBoundaryPolicyArn);
      this.checkAndOverride(node, this._rolePrefix, 64, 'RoleName', node.roleName);
    } else if (node instanceof CfnPolicy) {
      this.checkAndOverride(node, this._policyPrefix, 128, 'PolicyName', node.policyName);
    } else if (node instanceof CfnManagedPolicy) {
      this.checkAndOverride(node, this._policyPrefix, 128, 'ManagedPolicyName', node.managedPolicyName);
    } else if (node instanceof CfnInstanceProfile) {
      this.checkAndOverride(node, this._instanceProfilePrefix, 128, 'InstanceProfileName', node.instanceProfileName);
    }
  }
}
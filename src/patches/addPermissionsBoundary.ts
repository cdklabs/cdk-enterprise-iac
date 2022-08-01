import { CfnResource, IAspect, Stack, Token } from 'aws-cdk-lib';
import { CfnInstanceProfile, CfnManagedPolicy, CfnPolicy, CfnRole } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { getResourceId } from '../utils/utils';

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

  public checkAndOverride(node: CfnResource, prefix: string, length: number, cfnProp: string, cdkProp?: string): void {
    if (!cdkProp?.startsWith(prefix)) {
      const policySuffix = !Token.isUnresolved(cdkProp) ? cdkProp : getResourceId(node.node.path);
      node.addPropertyOverride(cfnProp, `${prefix}${policySuffix}`.substring(0, length - 1));
    }
  }

  public visit(node: IConstruct): void {
    if (node instanceof CfnRole) {
      const permissionsBoundaryPolicyArn = Stack.of(node).formatArn({
        service: 'iam',
        resource: 'policy',
        region: '',
        resourceName: this._permissionsBoundaryPolicyName,
      });
      node.addPropertyOverride('PermissionsBoundary', permissionsBoundaryPolicyArn);
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
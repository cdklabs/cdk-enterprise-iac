import { Aws, CfnResource, Environment, IAspect, region_info, Token } from 'aws-cdk-lib';
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
   * CDK environment (see https://docs.aws.amazon.com/cdk/v2/guide/environments.html)
   */
  readonly env: Environment;
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
  private _account: string;
  private _region: string;
  private _rolePrefix: string;
  private _policyPrefix: string;
  private _instanceProfilePrefix: string;
  private _permissionsBoundaryPolicyArn: string;

  constructor(props: AddPermissionBoundaryProps) {
    this._permissionsBoundaryPolicyName = props.permissionsBoundaryPolicyName;
    this._account = props.env.account || Aws.ACCOUNT_ID;
    this._region = props.env.region || Aws.REGION;

    this._rolePrefix = props.rolePrefix || '';
    this._policyPrefix = props.policyPrefix || '';
    this._instanceProfilePrefix = props.instanceProfilePrefix || '';

<<<<<<< Updated upstream
    this._permissionsBoundaryPolicyArn = `arn:${this._partition}:iam::${this._account}:policy/${this._permissionsBoundaryPolicyName}`;
=======
    const region = region_info.RegionInfo.get(this._region)

    this._permissionsBoundaryPolicyArn = `arn:${region.partition}:iam::${this._account}:policy/${this._permissionsBoundaryPolicyName}`;
>>>>>>> Stashed changes
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
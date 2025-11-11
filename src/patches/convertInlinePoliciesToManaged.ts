/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, Stack, IAspect, aws_iam as iam } from 'aws-cdk-lib';
import { Construct, IConstruct } from 'constructs';

/**
 * Patch for turning all Policies into ConvertInlinePoliciesToManaged
 *
 * Some users have policies in place that make it impossible to create inline policies. Instead,
 * they must use managed policies.
 *
 * Note that order matters with this aspect. Specifically, it should generally be added first.
 * This is because other aspects may add overrides that would be lost if applied before
 * this aspect since the original aspect is removed and replaced.
 *
 * @example
 * // Replace all AWS::IAM::Policy resources with equivalent AWS::IAM::ManagedPolicy
 * Aspects.of(stack).add(new ConvertInlinePoliciesToManaged())
 */
export class ConvertInlinePoliciesToManaged implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof iam.CfnPolicy) {
      const policy = node as iam.CfnPolicy;
      const stack = Stack.of(policy);
      const logicalId = stack.resolve(policy.logicalId);
      const policyDocument = stack.resolve(policy.policyDocument);
      const parent = policy.node.scope as Construct;

      const dependentResources = this.findDependentResources(policy, stack);
      parent.node.tryRemoveChild(policy.node.id);

      const resource = new iam.CfnManagedPolicy(parent, logicalId, {
        managedPolicyName: Stack.of(policy).resolve(policy.policyName),
        groups: policy.groups,
        roles: policy.roles,
        users: policy.users,
        policyDocument: policyDocument,
      });

      resource.overrideLogicalId(logicalId);

      const overrides = (node as any).rawOverrides;
      if (overrides?.Properties?.PolicyName) {
        resource.addPropertyOverride(
          'ManagedPolicyName',
          overrides?.Properties?.PolicyName
        );
      }

      // re-establish dependencies to the new managed policy
      for (const dependent of dependentResources) {
        dependent.addDependency(resource);
      }
    }
  }

  /**
   * Find all CfnResources that have a dependency on the given policy
   */
  private findDependentResources(
    policy: iam.CfnPolicy,
    stack: Stack
  ): CfnResource[] {
    const dependents: CfnResource[] = [];
    const policyLogicalId = stack.resolve(policy.logicalId);

    for (const child of stack.node.findAll()) {
      if (child instanceof CfnResource && child !== policy) {
        const deps = (child as any).dependsOn;
        if (Array.isArray(deps)) {
          const hasDependency = deps.some((dep: any) => {
            if (dep === policy) {
              return true;
            }
            if (typeof dep === 'object' && 'logicalId' in dep) {
              return stack.resolve(dep.logicalId) === policyLogicalId;
            }
            return false;
          });

          if (hasDependency) {
            dependents.push(child);
          }
        }
      }
    }

    return dependents;
  }
}

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Stack, IAspect, aws_iam as iam } from 'aws-cdk-lib';
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
      const logicalId = Stack.of(policy).resolve(policy.logicalId);
      const policyDocument = Stack.of(policy).resolve(policy.policyDocument);
      const parent = policy.node.scope as Construct;
      parent.node.tryRemoveChild(policy.node.id);

      const resource = new iam.CfnManagedPolicy(parent, logicalId, {
        managedPolicyName: Stack.of(policy).resolve(policy.policyName),
        groups: policy.groups,
        roles: policy.roles,
        policyDocument,
      });
      resource.overrideLogicalId(logicalId);

      const overrides = (node as any).rawOverrides;
      if (overrides?.Properties?.PolicyName) {
        resource.addPropertyOverride(
          'ManagedPolicyName',
          overrides?.Properties?.PolicyName
        );
      }
    }
  }
}

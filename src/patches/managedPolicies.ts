/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IAspect, aws_iam as iam } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

/**
 * Patch for turning all Policies into ManagedPolicies
 *
 * Some customers have policies in place that make it impossible to create standard policies. Instead,
 * they must use managed policies
 *
 * @example
 * // Replace all AWS::IAM::Policies with AWS::IAM::ManagedPolicies
 * Aspects.of(stack).add(new ManagedPolicies())
 */
export class ManagedPolicies implements IAspect {
  public visit(node: IConstruct): void {
    if (node instanceof iam.CfnPolicy) {
      const logicalId = node.stack.resolve(node.logicalId);
      const policyDocument = node.stack.resolve(node.policyDocument);
      const parent = node.node?.scope?.node;
      parent?.tryRemoveChild(node.node.id);

      const resource = new iam.CfnManagedPolicy(node.stack, logicalId, {
        managedPolicyName: node.stack.resolve(node.policyName),
        groups: node.groups,
        roles: node.roles,
        policyDocument,
      });
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

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, IAspect } from 'aws-cdk-lib';
import { IConstruct } from 'constructs';

export interface RemoveTagsProps {
  /**
   * Name of Cloudformation resource Type (e.g. 'AWS::Lambda::Function')
   */
  readonly cloudformationResource: string;

  /**
   * Name of the tag property to remove from the resource
   *
   * @default Tags
   */
  readonly tagPropertyName?: string;
}

/**
 * Patch for removing tags from a specific Cloudformation Resource
 *
 * In some regions, the 'Tags' property isn't supported in Cloudformation. This patch makes it easy to remove
 *
 * @example
 * // Remove tags on a resource
 * Aspects.of(stack).add(new RemoveTags({
 *   cloudformationResource: 'AWS::ECS::Cluster',
 * }));
 * // Remove tags without the standard 'Tags' name
 * Aspects.of(stack).add(new RemoveTags({
 *   cloudformationResource: 'AWS::Backup::BackupPlan',
 *    tagPropertyName: 'BackupPlanTags',
 * }));
 */
export class RemoveTags implements IAspect {
  private _cloudformationResource: string;
  private _tagPropertyName: string;

  constructor(props: RemoveTagsProps) {
    this._cloudformationResource = props.cloudformationResource;
    this._tagPropertyName = props.tagPropertyName || 'Tags';
  }

  public visit(node: IConstruct): void {
    if (
      CfnResource.isCfnResource(node) &&
      node.cfnResourceType == this._cloudformationResource
    ) {
      node.addPropertyDeletionOverride(this._tagPropertyName);
    }
  }
}

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

export class RemoveTags implements IAspect {

  private _cloudformationResource: string;
  private _tagPropertyName: string;

  constructor(props: RemoveTagsProps) {
    this._cloudformationResource = props.cloudformationResource;
    this._tagPropertyName = props.tagPropertyName || 'Tags';
  }

  public visit(node: IConstruct): void {
    if (CfnResource.isCfnResource(node) && node.cfnResourceType == this._cloudformationResource) {
      node.addPropertyDeletionOverride(this._tagPropertyName);
    }
  }
}
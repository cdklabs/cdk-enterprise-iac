/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { CfnResource, Fn, IAspect, Stack } from 'aws-cdk-lib';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import { CloudFormationStackArtifact } from 'aws-cdk-lib/cx-api';
import { IConstruct } from 'constructs';
import { CfnStore } from './cfnStore';
import { Flattener } from './flattener';
import { ResourceTransformer } from './resourceTransformer';
import { FlatJson, Json } from './types';

interface overrideFoundRefWithImportValueProps {
  readonly foundRefNode: CfnResource;
  readonly importValue: string;
  readonly flattenedKey: string;
}

interface deletionOverrideDependsOnProps {
  readonly foundRefNode: CfnResource;
  readonly flattenedKey: string;
}

interface modifyExtractedResourcePropertiesProps {
  readonly props: Json;
  readonly propsToAdjust: string[];
}

/**
 * The available value sharing methods to pass values from the extracted stack
 * onto the original stack(s).
 */
export enum ResourceExtractorShareMethod {
  'CFN_OUTPUT' = 'CFN_OUTPUT',
  'SSM_PARAMETER' = 'SSM_PARAMETER',
  'API_LOOKUP' = 'API_LOOKUP',
}

export interface ResourceExtractorProps {
  /** Stack to move found extracted resources into. */
  readonly extractDestinationStack: Stack;

  /** Synthed stack artifacts from your CDK app. */
  readonly stackArtifacts: CloudFormationStackArtifact[];

  /** The sharing method to use when passing exported resources from the "Extracted Stack" into the original stack(s). */
  readonly valueShareMethod?: ResourceExtractorShareMethod;

  /** List of resource types to extract, ex: `AWS::IAM::Role`. */
  readonly resourceTypesToExtract: string[];

  /** Additional resource transformations. */
  readonly additionalTransforms?: { [key: string]: string };
}

/**
 * This Aspect takes a CDK application, all synthesized CloudFormationStackArtifact,
 * a value share method, and a list of Cloudformation resources that should be
 * pulled out of the main CDK application, which should be synthesized to a
 * cloudformation template that an external team (e.g. security team) to deploy,
 * and adjusting the CDK application to reference pre-created resources already pulled out
 *
 * @example
    const app = App()
    const stack = new Stack(app, 'MyStack');
    extractedStack = new Stack(app, 'ExtractedStack');
    const synthedApp = app.synth();

    Aspects.of(app).add(new ResourceExtractor({
      extractDestinationStack: extractedStack,
      stackArtifacts: synthedApp.stacks,
      valueShareMethod: ResourceExtractorShareMethod.CFN_OUTPUT,
      resourceTypesToExtract: [
        'AWS::IAM::Role',
        'AWS::IAM::Policy',
        'AWS::IAM::ManagedPolicy',
        'AWS::IAM::InstanceProfile',
      ],
    });
    app.synth({ force: true });
 */
export class ResourceExtractor implements IAspect {
  private readonly extractDestinationStack: Stack;
  private readonly resourceTypesToExtract: string[];
  private readonly valueShareMethod: ResourceExtractorShareMethod =
    ResourceExtractorShareMethod.CFN_OUTPUT;
  private readonly logicalIdsNotGettingExtracted: FlatJson;
  private readonly cfn: CfnStore;
  private readonly resourceTransformer: ResourceTransformer;

  constructor(props: ResourceExtractorProps) {
    /** Save props */
    this.extractDestinationStack = props.extractDestinationStack;
    this.resourceTypesToExtract = props.resourceTypesToExtract;
    if (props.valueShareMethod) {
      this.valueShareMethod = props.valueShareMethod;
    }

    /** Initialize CfnStore to save templates and mappings */
    this.cfn = new CfnStore({
      extractedStackName: props.extractDestinationStack.stackName,
      region: props.extractDestinationStack.region,
      stackArtifacts: props.stackArtifacts,
      valueShareMethod: this.valueShareMethod,
    });

    /** Initialize resource transformer */
    this.resourceTransformer = new ResourceTransformer({
      cfnStore: this.cfn,
      additionalTransforms: props.additionalTransforms,
    });

    /** Save resources that are not getting extracted */
    this.logicalIdsNotGettingExtracted =
      this.getLogicalIdsNotGettingExtracted();
  }

  /** Entrypoint */
  public visit(node: IConstruct): void {
    // Ignore the extracted stack
    const anyNode = node as any;
    if (
      'stack' in anyNode &&
      anyNode.stack.toString() === this.extractDestinationStack.stackName
    ) {
      return;
    }

    // Process all resources
    if (node instanceof CfnResource) {
      if (this.resourceTypesToExtract.includes(node.cfnResourceType)) {
        this.processCfnResource(node);
      }
    }
  }

  /**
   * Takes in a CfnResource object and processes it by recreating it in
   * the Security Stack and deleting it from the stack in which it came
   * from.
   *
   * @param node the CfnResource to process
   */
  private processCfnResource(node: CfnResource): void {
    const stackName = node.stack.stackName;
    const logicalId = node.stack.resolve(node.logicalId);
    const props = this.cfn.templates[stackName].Resources[logicalId].Properties;

    /** Recreate resource in extracted stack and export value */
    if (
      !this.extractDestinationStack.node.tryFindChild(
        node.stack.resolve(logicalId)
      )
    ) {
      // Check if props include references to resources that _aren't_ being
      // extracted
      const flattenedProps = Flattener.flattenObject(props);
      const propsToAdjust = Object.keys(flattenedProps).filter((key) =>
        Object.keys(this.logicalIdsNotGettingExtracted).includes(
          flattenedProps[key]
        )
      );

      // If properties being extracted to another stack contain
      // references to resources in the original stack, we need to adjust
      let modifiedProps: Json = {};
      if (propsToAdjust) {
        modifiedProps = this.modifyExtractedResourceProperties({
          props,
          propsToAdjust,
        });
      }

      // Add to extracted stack
      const res = new CfnResource(this.extractDestinationStack, logicalId, {
        type: node.cfnResourceType,
        properties: modifiedProps || props,
      });

      // Look in all existing stacks for any refs to the resource being
      // extracted
      const foundRefs = Object.keys(this.cfn.flatTemplates).filter(
        (key) => this.cfn.flatTemplates[key] === logicalId
      );

      // loop through resources in stack with Cfn intrinsic functions
      // referencing extracted resources
      for (const foundRef of foundRefs) {
        // See if the found ref is also getting extracted. Ignore if so.
        if (this.isRefAlsoGettingExtracted(foundRef)) continue;

        // Get the CfnResource that is referencing this extracted resource
        const foundRefNode = this.getResourceFromFoundRef(
          node,
          foundRef
        ) as CfnResource;

        // Figure out the pattern of how extracted resource is being referenced
        // e.g. using `Fn::GetAtt` or `Ref`
        const exportValue = this.cfn.determineExportValue(node, foundRef);
        if (exportValue) {
          // Generate export in ExportedStack, and return the `Fn::ImportValue`
          // method to use when referencing in the App stack
          const importValue = this.exportValue(
            node.stack,
            this.extractDestinationStack.resolve(res.logicalId),
            exportValue
          );

          // Override any ref to extracted resource
          this.overrideFoundRefWithImportValue({
            foundRefNode,
            importValue,
            flattenedKey: foundRef,
          });
        }

        // Remove any DependsOn references
        this.deletionOverrideDependsOn({
          foundRefNode,
          flattenedKey: foundRef,
        });
      }
    }

    /** Delete from original stack */
    const removed = node.stack.node.tryRemoveChild(node.node.id);
    if (!removed) {
      const parent = node.node.scope?.node;
      parent?.tryRemoveChild(node.node.id);
    }
  }

  /**
   * This will adjust properties in extracted resources that have
   * CloudFormation intrinsic functions referencing resources in the original
   * stack.
   *
   * Most commonly found in IAM policies that scope IAM actions to specific
   * resources in the Stack the policy is being extracted from. In this case
   * it will take a look at the resource type and transform into a partial ARN.
   *
   * @param props modifyExtractedResourcePropertiesProps
   * @returns Json of modified properties, including partial wildcard matchers
   */
  private modifyExtractedResourceProperties(
    props: modifyExtractedResourcePropertiesProps
  ): Json {
    let modifiedProps = props.props;
    for (const key in props.propsToAdjust) {
      if (Object.prototype.hasOwnProperty.call(props.propsToAdjust, key)) {
        const resourceLogicalIdToReplace = Flattener.getValueByPath(
          props.props,
          props.propsToAdjust[key]
        );
        const partial = this.resourceTransformer.toPartial(
          resourceLogicalIdToReplace
        );

        const splitKey = props.propsToAdjust[key].split('.');
        if (splitKey.slice(-1)[0] == 'Ref') {
          Flattener.setToValue(
            modifiedProps,
            splitKey.slice(0, -1).join('.'),
            partial
          );
        } else if (splitKey.slice(-2)[0] == 'Fn::GetAtt') {
          Flattener.setToValue(
            modifiedProps,
            splitKey.slice(0, -2).join('.'),
            partial
          );
        }
      }
    }
    return modifiedProps;
  }

  /**
   * This takes the flattened key of the resource that's referencing an
   * extracted resource via Cfn intrinsic function, the CfnResource itself
   * (e.g. CfnFunction) as well as the import value (from
   * determineExportValue), and adds a Property override.
   *
   * @param props overrideFoundRefWithImportValueProps
   */
  private overrideFoundRefWithImportValue(
    props: overrideFoundRefWithImportValueProps
  ): void {
    // find property to override
    const splitKey = props.flattenedKey.split('.');
    let propertyOverridePath: string;
    if (splitKey.slice(-1)[0] == 'Ref') {
      propertyOverridePath = splitKey.slice(4, -1).join('.');
    } else if (splitKey.slice(-2)[0] == 'Fn::GetAtt') {
      propertyOverridePath = splitKey.slice(4, -2).join('.');
    } else {
      propertyOverridePath = 'notFound';
    }
    if (this.valueShareMethod == ResourceExtractorShareMethod.CFN_OUTPUT) {
      props.foundRefNode.addPropertyOverride(
        propertyOverridePath,
        props.foundRefNode.stack.resolve(props.importValue)
      );
    } else if (
      this.valueShareMethod == ResourceExtractorShareMethod.SSM_PARAMETER
    ) {
      props.foundRefNode.addPropertyOverride(
        propertyOverridePath,
        StringParameter.valueFromLookup(
          props.foundRefNode.stack,
          props.importValue
        )
      );
    } else if (
      this.valueShareMethod == ResourceExtractorShareMethod.API_LOOKUP
    ) {
      const importValue = props.foundRefNode.stack.resolve(props.importValue)[
        'Fn::ImportValue'
      ];
      props.foundRefNode.addPropertyOverride(
        propertyOverridePath,
        this.cfn.extractedStackExports[importValue] ||
          `dummy-value-for-${importValue}`
      );
    }
  }

  /**
   * Remove a `DependsOn` reference when not needed
   *
   * @param props
   */
  private deletionOverrideDependsOn(
    props: deletionOverrideDependsOnProps
  ): void {
    const splitKey = props.flattenedKey.split('.');
    if (splitKey.slice(-2)[0] == 'DependsOn') {
      props.foundRefNode.addDeletionOverride(
        `DependsOn.${splitKey.slice(-1)[0]}`
      );
    }
  }

  /**
   * Finds the CDK resource for a given flattened key by looking it up in the
   * context of the provided node's stack.
   *
   * @param node
   * @param flattendKey
   * @returns CfnResource
   */
  private getResourceFromFoundRef(
    node: CfnResource,
    flattendKey: string
  ): IConstruct | undefined {
    const foundRefLogicalId = flattendKey.split('.')[2];
    return node.stack.node.findAll().find((x: any) => {
      if ('stack' in x && 'logicalId' in x) {
        return x.stack.resolve(x.logicalId) == foundRefLogicalId;
      } else {
        return undefined;
      }
    });
  }

  /**
   * Given a flattened key, determine if the resouce is also getting
   * extracted so we know whether or not to adjust CloudFormation Intrinsic
   * functions.
   *
   * @param flattendKey
   * @returns boolean
   */
  private isRefAlsoGettingExtracted(flattendKey: string): boolean {
    const splitKey = flattendKey.split('.');
    const pathToType = Flattener.getValueByPath(
      this.cfn.templates,
      splitKey.slice(0, 3).concat(['Type']).join('.')
    );
    return this.resourceTypesToExtract.includes(pathToType);
  }

  /**
   * Get a list of logical ids of resources _not_ getting exported.
   *
   * @returns flat json in the form of `{ LogicalId: 'ResourceType' }`
   */
  private getLogicalIdsNotGettingExtracted(): FlatJson {
    const logicalIds: FlatJson = {};
    for (const key in this.cfn.flatTemplates) {
      if (Object.prototype.hasOwnProperty.call(this.cfn.flatTemplates, key)) {
        const splitKey = key.split('.');
        if (
          splitKey.slice(-1)[0] == 'Type' &&
          splitKey.slice(1, 2)[0] == 'Resources'
        ) {
          if (
            !this.resourceTypesToExtract.includes(this.cfn.flatTemplates[key])
          ) {
            logicalIds[splitKey.slice(-2)[0]] = this.cfn.flatTemplates[key];
          }
        }
      }
    }
    return logicalIds;
  }

  /**
   * Exports a value using a consistent standard for the different value
   * share methods.
   *
   * @param stack - the CDK `Stack` object for the resource to import
   * @param name - the name of the export, normally the LogicalId of the
   * resource being exported
   * @param value - the value to export
   */
  private exportValue(stack: Stack, name: string, value: any): string {
    const stackName = stack.stackName;
    const shareName = `${stackName}:${name}`;

    if (this.valueShareMethod == ResourceExtractorShareMethod.SSM_PARAMETER) {
      const paramName = `/${shareName.replace(':', '/')}`;
      const paramLogicalId = `p${name}`;
      if (!this.extractDestinationStack.node.tryFindChild(paramLogicalId)) {
        new CfnResource(this.extractDestinationStack, paramLogicalId, {
          type: 'AWS::SSM::Parameter',
          properties: {
            Name: paramName,
            Type: 'String',
            Value: stack.resolve(value),
          },
        });
      }
      return paramName;
    } else {
      // CFN_OUTPUT and API_LOOKUP share the same method of exporting values
      if (
        !this.extractDestinationStack.node.tryFindChild(
          `Export${stackName}:${name}`
        )
      ) {
        return this.extractDestinationStack.exportValue(stack.resolve(value), {
          name: shareName,
        });
      } else {
        return Fn.importValue(shareName);
      }
    }
  }
}

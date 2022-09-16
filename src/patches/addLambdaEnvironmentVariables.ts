/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { IAspect } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { IConstruct } from 'constructs';

/**
 * Add one or more environment variables to _all_ lambda functions within a scope
 *
 * @extends IAspect
 */
export class AddLambdaEnvironmentVariables implements IAspect {
  /**
   * Key value pairs of environment variables to add to all lambda functions within the scope
   */
  private _environmentKeyValues: { [key: string]: string };

  /**
   *
   * @param props {[key: string]: string} props - Key Value pair(s) for environment variables to add to all lambda functions
   */
  constructor(props: { [key: string]: string }) {
    this._environmentKeyValues = props;
  }

  public visit(node: IConstruct): void {
    if (node instanceof Function) {
      const lmb: Function = node;
      for (const [key, value] of Object.entries(this._environmentKeyValues)) {
        lmb.addEnvironment(key, value);
      }
    }
  }
}

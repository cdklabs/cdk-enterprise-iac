/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Token } from 'aws-cdk-lib';
import { createHash } from 'crypto';

export const getResourceId = (resourcePath: string): string => {
  return resourcePath.replace(/[/:]/g, '-');
};

export const computeUniqueHash = (
  nodePath: string,
  region: string,
  length: number = 8
): string => {
  // don't include region in hash if its a token
  const hashInput = Token.isUnresolved(region) ? nodePath : `${nodePath}-${region}`;
  const hash = createHash('shake256');
  hash.update(hashInput);
  const hashValue = hash.digest('hex');
  return hashValue.substring(hashValue.length - length, hashValue.length);
};

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { createHash } from 'crypto';

export const getResourceId = (resourcePath: string): string => {
  return resourcePath.replace(/[/:]/g, '-');
};

export const computeUniqueHash = (
  nodePath: string,
  region: string,
  length: number = 8
): string => {
  const hash = createHash('shake256');
  hash.update(`${nodePath}-${region}`);
  const hashValue = hash.digest('hex');
  return hashValue.substring(hashValue.length - length, hashValue.length);
};

/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { getResourceId, computeUniqueHash } from '../../src/utils/utils';

describe('Testing utils', () => {
  test('getResourceId returns valid name', () => {
    const nodePath = 'Default/TestInlinePolicy/Resource';
    expect(getResourceId(nodePath)).toBe('Default-TestInlinePolicy-Resource');
  });
  test('getResourceId returns valid name and replaces illegal characters for IAM role,policy and instance profile names', () => {
    const nodePath = 'Default/TestInlinePolicy/Resource:extra:stuff';
    expect(getResourceId(nodePath)).toBe(
      'Default-TestInlinePolicy-Resource-extra-stuff'
    );
  });
  describe('computeUniqueHash', () => {
    test('returns 8 characters by default', () => {
      const hash = computeUniqueHash('TestStack/TestRole', 'us-east-1');
      expect(hash.length).toBe(8);
    });
    test('is deterministic with same inputs', () => {
      const nodePath = 'TestStack/TestRole';
      const region = 'us-east-1';

      const hash1 = computeUniqueHash(nodePath, region);
      const hash2 = computeUniqueHash(nodePath, region);
      const hash3 = computeUniqueHash(nodePath, region);

      expect(hash1).toEqual(hash2);
      expect(hash2).toEqual(hash3);
    });

    test('produces different hashes for different paths', () => {
      const region = 'us-east-1';

      const hash1 = computeUniqueHash('TestStack/RoleA', region);
      const hash2 = computeUniqueHash('TestStack/RoleB', region);

      expect(hash1).not.toEqual(hash2);
    });

    test('produces different hashes for different regions', () => {
      const nodePath = 'TestStack/TestRole';

      const hash1 = computeUniqueHash(nodePath, 'us-east-1');
      const hash2 = computeUniqueHash(nodePath, 'us-west-2');

      expect(hash1).not.toEqual(hash2);
    });
    test('Region token causes different hash', () => {
      const nodePath = 'TestStack/TestRole/Resource';

      // simulate: token vs resolved value
      const hashWithToken = computeUniqueHash(nodePath, '\${Token[AWS::Region.1234]}');
      const hashWithResolved = computeUniqueHash(nodePath, 'us-east-1');

      console.log('Hash with token:', hashWithToken);
      console.log('Hash with resolved:', hashWithResolved);

      // should will be different, confirming the simulation
      expect(hashWithToken).not.toEqual(hashWithResolved);
    });
  });
});

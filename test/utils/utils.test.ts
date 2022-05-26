import { getResourceId } from '../../src/utils/utils';

describe('Testing utils', () => {
  test('getResourceId returns valid name', () => {
    const nodePath = 'Default/TestInlinePolicy/Resource';
    expect(getResourceId(nodePath)).toBe('Default-TestInlinePolicy-Resource');
  });
  test('getResourceId returns valid name and replaces illegal characters for IAM role,policy and instance profile names', () => {
    const nodePath = 'Default/TestInlinePolicy/Resource:extra:stuff';
    expect(getResourceId(nodePath)).toBe('Default-TestInlinePolicy-Resource-extra-stuff');
  });
});
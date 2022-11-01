import { Flattener } from '../../../src/patches/resource-extractor/flattener';

let complexObject: Object;

describe('Flattener', () => {
  beforeEach(() => {
    complexObject = {
      Foo: {
        Bar: 'Baz',
      },
    };
  });

  test('Flatten an object', () => {
    const flattened = Flattener.flattenObject(complexObject);
    expect(flattened).toEqual({ 'Foo.Bar': 'Baz' });
  });

  test('Lookup flattened key', () => {
    const lookup = Flattener.getValueByPath(complexObject, 'Foo.Bar');
    expect(lookup).toEqual('Baz');
  });

  test('Set from flattened key', () => {
    Flattener.setToValue(complexObject, 'Foo.Bar', 'newValue');
    expect(complexObject).toEqual({ Foo: { Bar: 'newValue' } });
  });
});

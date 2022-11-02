/*
Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
SPDX-License-Identifier: Apache-2.0
*/
import { Json, FlatJson } from './types';

/**
 * Contains static helper functions to deal with flattening objects,
 * retrieving values from flat objects and setting values on flat objects.
 */
export class Flattener {
  /**
   * Flattens a provided Json object, moving all nested objects to the top
   * level and separating with dots, example:
   * ```
   * {
   *   "Stack.Resources.Foo.Properties.Tags.0.Value": "bar"
   * }
   * ```
   *
   * @param obj complex object to flatten
   * @returns key-value pairs of object separated by dots, and the value
   */
  public static flattenObject = (obj: Json): FlatJson => {
    var toReturn: { [key: string]: string } = {};
    for (let i in obj) {
      if (!obj.hasOwnProperty(i)) continue;

      if (typeof obj[i] == 'object' && obj[i] !== null) {
        let flatObject = Flattener.flattenObject(obj[i]);
        for (let x in flatObject) {
          if (!flatObject.hasOwnProperty(x)) continue;
          toReturn[i + '.' + x] = flatObject[x];
        }
      } else {
        toReturn[i] = obj[i];
      }
    }
    return toReturn;
  };

  /**
   * Retrieves a value from a provided Json object by using the provided flat
   * path to look it up
   *
   * @param obj object to search through
   * @param path string of where in the object to get, separated by dots
   * @returns found value
   */
  public static getValueByPath = (obj: Json, path: string): any =>
    path.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);

  /**
   * Updates a value in a provided Json object by using the provided flat
   * path to look it up and the provided value to set
   *
   * @param obj object to update
   * @param path string of path to key to update (separated by dots)
   * @param value value to set in object path
   */
  public static setToValue = (obj: Json, path: string, value: any): void => {
    let i;
    const pathSplit = path.split('.');
    for (i = 0; i < pathSplit.length - 1; i++) obj = obj[pathSplit[i]];
    obj[pathSplit[i]] = value;
  };
}

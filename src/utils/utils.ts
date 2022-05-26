export const getResourceId = (resourcePath: string): string => {
  return resourcePath.replace(/[/:]/g, '-');
};
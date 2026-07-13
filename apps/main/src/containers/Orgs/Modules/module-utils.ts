export const getModuleSourceUrl = (source: string) => {
  return source.replace(/^.*?::/, '');
};

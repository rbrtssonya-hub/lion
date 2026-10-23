import path from 'node:path';

export function resolveBundledIcon(argv, project, defaultIcon) {
  const option = argv.find(argument => argument.startsWith('--icon='));
  if (option === undefined) return path.resolve(defaultIcon);

  const value = option.slice('--icon='.length);
  if (!value) throw new Error('The icon path cannot be empty.');
  return path.resolve(project, value);
}

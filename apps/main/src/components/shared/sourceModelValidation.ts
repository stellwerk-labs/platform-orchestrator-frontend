import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import type { MonacoYaml } from 'monaco-yaml';

export type SourceValidation = {
  source: string;
  format: 'json' | 'yaml';
  schema: Record<string, unknown>;
  modelUri: string;
  modelVersion: number;
  status: 'pending' | 'valid' | 'invalid' | 'unavailable';
  messages: string[];
};

const jsonMessages = async (model: monaco.editor.ITextModel): Promise<string[]> => {
  const factory = await monaco.languages.json.getWorker();
  const worker = await factory(model.uri);
  const validator = worker as typeof worker & { doValidation?: unknown };
  // Monaco 0.52.2 implements this method but omits it from IJSONWorker's public type.
  if (typeof validator.doValidation !== 'function') throw new Error('Validation unavailable');
  if (!(await worker.parseJSONDocument(model.uri.toString())))
    throw new Error('Model is not synchronized');
  const diagnostics: unknown = await validator.doValidation(model.uri.toString());
  if (!Array.isArray(diagnostics)) throw new Error('Validation unavailable');
  return diagnostics.map((diagnostic: unknown) => {
    if (
      !diagnostic ||
      typeof diagnostic !== 'object' ||
      !('message' in diagnostic) ||
      typeof diagnostic.message !== 'string'
    )
      throw new Error('Validation unavailable');
    return diagnostic.message.slice(0, 300);
  });
};

const yamlMessages = async (model: monaco.editor.ITextModel, yaml: MonacoYaml) => {
  if (yaml.getOptions().validate !== true || model.getLanguageId() !== 'yaml')
    throw new Error('Validation unavailable');
  // Pinned monaco-yaml 5.5.1 synchronizes each live model and awaits its marker provider.
  // Initial/cleared empty markers alone never establish completion.
  await yaml.update({});
  return monaco.editor
    .getModelMarkers({ owner: 'yaml', resource: model.uri })
    .map((marker) => marker.message.slice(0, 300));
};

export const watchSourceValidation = (
  model: monaco.editor.ITextModel,
  format: 'json' | 'yaml',
  schema: Record<string, unknown>,
  yaml: MonacoYaml,
  report: (result: SourceValidation) => void,
) => {
  let disposed = false;
  let revision = 0;
  let timer: ReturnType<typeof setTimeout>;
  const schedule = () => {
    clearTimeout(timer);
    const request = ++revision;
    const snapshot = {
      source: model.getValue(),
      format,
      schema,
      modelUri: model.uri.toString(),
      modelVersion: model.getVersionId(),
    };
    const current = () =>
      !disposed &&
      request === revision &&
      !model.isDisposed() &&
      monaco.editor.getModel(model.uri) === model &&
      model.getLanguageId() === format &&
      model.getVersionId() === snapshot.modelVersion &&
      model.getValue() === snapshot.source;
    report({ ...snapshot, status: 'pending', messages: [] });
    timer = setTimeout(() => {
      void (async () => {
        try {
          const messages =
            format === 'json' ? await jsonMessages(model) : await yamlMessages(model, yaml);
          if (current())
            report({
              ...snapshot,
              status: messages.length ? 'invalid' : 'valid',
              messages: messages.slice(0, 10),
            });
        } catch {
          if (current())
            report({
              ...snapshot,
              status: 'unavailable',
              messages: [
                'Validation could not finish. Your source has been kept. Retry the editor.',
              ],
            });
        }
      })();
    }, 300);
  };
  const subscription = model.onDidChangeContent(schedule);
  schedule();
  return {
    dispose: () => {
      disposed = true;
      clearTimeout(timer);
      subscription.dispose();
    },
  };
};

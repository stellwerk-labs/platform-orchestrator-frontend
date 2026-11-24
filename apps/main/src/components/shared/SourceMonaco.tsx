import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker.js?worker';
import { configureMonacoYaml } from 'monaco-yaml';
import YamlWorker from 'monaco-yaml/yaml.worker.js?worker';
import { useEffect, useRef } from 'react';

// Register normal editor commands and widgets; language contributions stay limited below.
import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution.js';

import { type SourceValidation, watchSourceValidation } from './sourceModelValidation';

window.MonacoEnvironment = {
  getWorker: (_id, label) =>
    label === 'yaml' ? new YamlWorker() : label === 'json' ? new JsonWorker() : new EditorWorker(),
};

export const SourceMonaco = ({
  documentName,
  ariaLabel,
  value,
  format,
  schema,
  readOnly,
  dark,
  onChange,
  onValidation,
}: {
  documentName: string;
  ariaLabel: string;
  value: string;
  format: 'json' | 'yaml';
  schema: Record<string, unknown>;
  readOnly: boolean;
  dark: boolean;
  onChange: (value: string) => void;
  onValidation?: (result: SourceValidation) => void;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | undefined>(undefined);
  const changed = useRef(onChange);
  changed.current = onChange;
  const reported = useRef(onValidation);
  reported.current = onValidation;
  const validates = Boolean(onValidation);
  useEffect(() => {
    if (!host.current) return;
    const uri = monaco.Uri.parse(
      `inmemory://stellwerk/${crypto.randomUUID()}/${documentName}.${format}`,
    );
    const schemas = [
      { uri: `inmemory://stellwerk/${documentName}-schema`, fileMatch: [uri.toString()], schema },
    ];
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: false,
      schemas,
    });
    const yaml = configureMonacoYaml(monaco, {
      enableSchemaRequest: false,
      validate: true,
      completion: true,
      hover: true,
      schemas,
    });
    const model = monaco.editor.createModel(value, format, uri);
    const instance = monaco.editor.create(host.current, {
      model,
      readOnly,
      theme: dark ? 'vs-dark' : 'vs',
      automaticLayout: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      ariaLabel,
      fontSize: 14,
      tabSize: 2,
    });
    editor.current = instance;
    const subscription = model.onDidChangeContent(() => changed.current(model.getValue()));
    const validation = validates
      ? watchSourceValidation(model, format, schema, yaml, (result) => reported.current?.(result))
      : undefined;
    return () => {
      validation?.dispose();
      subscription.dispose();
      instance.dispose();
      model.dispose();
      yaml.dispose();
      editor.current = undefined;
    };
    // Recreate the language model only when its language or schema changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, schema, documentName, ariaLabel, validates]);
  useEffect(() => {
    if (editor.current?.getValue() !== value) editor.current?.setValue(value);
  }, [value]);
  useEffect(() => {
    editor.current?.updateOptions({ readOnly });
  }, [readOnly]);
  useEffect(() => {
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
  }, [dark]);
  return (
    <div
      ref={host}
      style={{ height: 540, border: '1px solid var(--ant-color-border)', borderRadius: 6 }}
    />
  );
};

export const formatGeneratedJSDoc = (source) =>
  source.replace(
    /^([\t ]*)\/\*\*([\s\S]*?)\*\//gm,
    (_, indent, body) =>
      `${indent}/**${body
        .split('\n')
        .map((line, index, lines) =>
          index > 0 && index < lines.length - 1 && !line.trim() ? `${indent} *` : line,
        )
        .join('\n')
        .replace(/^([\t ]*\* )@pattern[\t ]+(.+)$/gm, '$1Pattern: $2')}*/`,
  );

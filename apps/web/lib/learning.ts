// Bulk quiz import accepts JSON with comments.
/**
 * Strips /* ... *\/ block comments and // line comments before JSON.parse.
 */
export function stripJsonComments(input: string): string {
  let inString = false;
  let stringChar = '';
  let isEscaped = false;
  let inBlockComment = false;
  let inLineComment = false;
  let result = '';

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const nextChar = input[i + 1];

    if (inBlockComment) {
      if (char === '*' && nextChar === '/') {
        inBlockComment = false;
        i++; // skip /
      }
      continue;
    }

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
        result += char;
      }
      continue;
    }

    if (inString) {
      result += char;
      if (isEscaped) {
        isEscaped = false;
      } else if (char === '\\') {
        isEscaped = true;
      } else if (char === stringChar) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringChar = char;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    result += char;
  }

  return result.trim();
}

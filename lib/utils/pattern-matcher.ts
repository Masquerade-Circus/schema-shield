const REGEX_META_CHARS = /[\\.^$*+?()[\]{}|]/;

function hasRegexMeta(value: string) {
  return REGEX_META_CHARS.test(value);
}

export type CompiledPatternMatcher = RegExp | ((value: string) => boolean);

export function compilePatternMatcher(pattern: string): CompiledPatternMatcher {
  if (pattern.length === 0) {
    return (_value: string) => true;
  }

  if (!hasRegexMeta(pattern)) {
    return (value: string) => value.includes(pattern);
  }

  const patternLength = pattern.length;

  if (patternLength >= 2 && pattern[0] === "^" && pattern[patternLength - 1] === "$") {
    const inner = pattern.slice(1, -1);
    if (!hasRegexMeta(inner)) {
      if (inner.length === 0) {
        return (value: string) => value.length === 0;
      }

      return (value: string) => value === inner;
    }
  }

  if (pattern[0] === "^") {
    const inner = pattern.slice(1);
    if (!hasRegexMeta(inner)) {
      if (inner.length === 0) {
        return (_value: string) => true;
      }

      return (value: string) => value.startsWith(inner);
    }
  }

  if (pattern[patternLength - 1] === "$") {
    const inner = pattern.slice(0, -1);
    if (!hasRegexMeta(inner)) {
      if (inner.length === 0) {
        return (_value: string) => true;
      }

      return (value: string) => value.endsWith(inner);
    }
  }

  return new RegExp(pattern, "u");
}

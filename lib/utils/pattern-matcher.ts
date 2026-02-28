const REGEX_META_CHARS = /[\\.^$*+?()[\]{}|]/;

function hasRegexMeta(value: string) {
  return REGEX_META_CHARS.test(value);
}

const PATTERN_CACHE = new Map<string, CompiledPatternMatcher>();

export type CompiledPatternMatcher = RegExp | ((value: string) => boolean);

export function compilePatternMatcher(pattern: string): CompiledPatternMatcher {
  const cached = PATTERN_CACHE.get(pattern);
  if (cached) {
    return cached;
  }

  let compiled: CompiledPatternMatcher;

  if (pattern.length === 0) {
    compiled = (_value: string) => true;
  } else if (!hasRegexMeta(pattern)) {
    compiled = (value: string) => value.includes(pattern);
  } else {
    const patternLength = pattern.length;

    if (patternLength >= 2 && pattern[0] === "^" && pattern[patternLength - 1] === "$") {
      const inner = pattern.slice(1, -1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (value: string) => value.length === 0;
        } else {
          compiled = (value: string) => value === inner;
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else if (pattern[0] === "^") {
      const inner = pattern.slice(1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (_value: string) => true;
        } else {
          compiled = (value: string) => value.startsWith(inner);
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else if (pattern[patternLength - 1] === "$") {
      const inner = pattern.slice(0, -1);
      if (!hasRegexMeta(inner)) {
        if (inner.length === 0) {
          compiled = (_value: string) => true;
        } else {
          compiled = (value: string) => value.endsWith(inner);
        }
      } else {
        compiled = new RegExp(pattern, "u");
      }
    } else {
      compiled = new RegExp(pattern, "u");
    }
  }

  PATTERN_CACHE.set(pattern, compiled);
  return compiled;
}

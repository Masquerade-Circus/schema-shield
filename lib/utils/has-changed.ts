// Utility function to check if dependencies have changed recursively
// eslint-disable-next-line sonarjs/cognitive-complexity
export function hasChanged(prev: any, current: any) {
  if (Object.is(prev, current)) {
    return false;
  }

  if (Array.isArray(prev)) {
    if (Array.isArray(current) === false) {
      return true;
    }

    if (prev.length !== current.length) {
      return true;
    }

    for (let i = 0; i < current.length; i++) {
      if (hasChanged(prev[i], current[i])) {
        return true;
      }
    }

    return false;
  }

  if (typeof prev === "object" && prev !== null) {
    if (typeof current !== "object" || current === null) {
      return true;
    }

    for (const key in current) {
      if (hasChanged(prev[key], current[key])) {
        return true;
      }
    }

    for (const key in prev) {
      if (key in current) {
        continue;
      }

      if (hasChanged(prev[key], undefined)) {
        return true;
      }
    }

    return false;
  }

  return true;
}

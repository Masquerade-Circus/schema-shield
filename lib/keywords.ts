import { ArrayKeywords } from "./keywords/array-keywords";
import { NumberKeywords } from "./keywords/number-keywords";
import { ObjectKeywords } from "./keywords/object-keywords";
import { OtherKeywords } from "./keywords/other-keywords";
import { StringKeywords } from "./keywords/string-keywords";
import { ValidatorFunction } from "./index";

export const keywords: Record<string, ValidatorFunction> = {
  ...ObjectKeywords,
  ...ArrayKeywords,
  ...StringKeywords,
  ...NumberKeywords,
  ...OtherKeywords
};

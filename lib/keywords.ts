import { ArrayKeywords } from "./keywords/array-keywords";
import { KeywordFunction } from "./index";
import { NumberKeywords } from "./keywords/number-keywords";
import { ObjectKeywords } from "./keywords/object-keywords";
import { OtherKeywords } from "./keywords/other-keywords";
import { StringKeywords } from "./keywords/string-keywords";

export const keywords: Record<string, KeywordFunction | false> = {
  ...ObjectKeywords,
  ...ArrayKeywords,
  ...StringKeywords,
  ...NumberKeywords,
  ...OtherKeywords
};

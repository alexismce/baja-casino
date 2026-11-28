import { randomInt } from "node:crypto";

export function getSecureRandomNumber(min, max) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new RangeError("Random-number bounds must be safe integers with min <= max.");
  }

  if (max - min >= 2 ** 48) {
    throw new RangeError("Random-number range must be smaller than 2^48.");
  }

  return randomInt(min, max + 1);
}

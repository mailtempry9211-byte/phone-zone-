/**
 * Verhoeff checksum - the algorithm UIDAI uses for Aadhaar numbers.
 * Validates a 12-digit Aadhaar BEFORE we trust an OCR reading (OCR can mistype
 * one digit; the checksum catches it).
 */

// dihedral group D5 multiplication table
const M = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// permutation table
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

/** Inverse table used for validation. */
const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

/** Extract the digits of an Aadhaar from any OCR text ("XXXX XXXX XXXX"). */
export const aadhaarDigits = (text: string): string => (text || "").replace(/\D/g, "");

/** Verhoeff validation for a digit string of any length. */
export const verhoeffValidate = (digits: string): boolean => {
  if (!/^\d{12}$/.test(digits)) return false;
  let c = 0;
  const reversed = digits.split("").reverse().map(Number);
  for (let i = 0; i < reversed.length; i++) {
    c = M[c][P[i % 8][reversed[i]]];
  }
  return c === 0;
};

/**
 * Best-effort: if a raw 12-digit run fails the checksum, try single-digit
 * corrections (OCR commonly drops/strikes one character). Returns the corrected
 * number only when EXACTLY one candidate validates.
 */
export const repairAadhaar = (digits: string): string | null => {
  if (verhoeffValidate(digits)) return digits;
  const fixes: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    for (let d = 0; d <= 9; d++) {
      if (String(d) === digits[i]) continue;
      const candidate = digits.slice(0, i) + d + digits.slice(i + 1);
      if (verhoeffValidate(candidate)) fixes.push(candidate);
    }
  }
  return fixes.length === 1 ? fixes[0] : null;
};

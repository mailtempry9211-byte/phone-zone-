/**
 * Amount in words, Indian numbering system (crore / lakh / thousand / hundred).
 *
 * This prints on invoices and return vouchers, so the grammar matters:
 *   - tens are hyphenated      ("forty-five", not "forty five")
 *   - no double spaces / no missing spaces between groups ("one crore", not
 *     "onecrore" or "one  crore")
 *   - large crore counts recurse, so 1,00,00,000 * 1000 still reads correctly
 */

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 1-99 as words ("forty-five"). */
function twoDigits(num: number): string {
  if (num < 10) return ONES[num];
  if (num < 20) return TEENS[num - 10];
  const tens = Math.floor(num / 10);
  const ones = num % 10;
  return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
}

/** 1-999 as words ("one hundred twenty-three"). */
function threeDigits(num: number): string {
  const hundreds = Math.floor(num / 100);
  const rest = num % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(' ');
}

export function numberToWords(num: number): string {
  const value = Math.floor(Math.abs(Number(num) || 0));
  if (value === 0) return 'zero';

  const crore = Math.floor(value / 10000000);
  const lakh = Math.floor((value % 10000000) / 100000);
  const thousand = Math.floor((value % 100000) / 1000);
  const rest = value % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberToWords(crore)} crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} thousand`);
  if (rest) parts.push(threeDigits(rest));

  return parts.join(' ');
}

/** "One thousand two hundred fifty rupees only" - used on return vouchers. */
export function formatCurrency(amount: number): string {
  const words = numberToWords(amount);
  return words.charAt(0).toUpperCase() + words.slice(1) + ' rupees only';
}

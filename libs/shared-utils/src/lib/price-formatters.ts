/**
 * Treasury Price Formatters
 * 
 * Utility functions for formatting fixed income prices in various formats
 * commonly used in Treasury and bond trading.
 */

/**
 * Converts a decimal price to Treasury 32nds format.
 * 
 * Treasury securities are quoted in 32nds of a point. For example:
 * - 99-16 means 99 and 16/32 = 99.5
 * - 99-16+ means 99 and 16.5/32 = 99.515625 (the "+" indicates a half-tick or 1/64)
 * 
 * Format: handle-ticks[suffix]
 * - handle: whole number portion (e.g., 99)
 * - ticks: 32nds (00-31), always 2 digits
 * - suffix: fractional ticks
 *   - +: half tick (1/64 = 0.5/32)
 *   - ¼: quarter tick (1/128 = 0.25/32)
 *   - ¾: three-quarter tick (3/128 = 0.75/32)
 * 
 * @param decimalPrice - The decimal price to format (e.g., 99.515625)
 * @returns Formatted string in Treasury 32nds notation (e.g., "99-16+")
 * 
 * @example
 * formatTreasury32nds(99.5)       // "99-16"
 * formatTreasury32nds(99.515625)  // "99-16+"
 * formatTreasury32nds(99.40625)   // "99-13"
 * formatTreasury32nds(100.0)      // "100-00"
 * formatTreasury32nds(null)       // "-"
 */
export function formatTreasury32nds(decimalPrice: number | null | undefined): string {
  if (decimalPrice == null) {
    return '-';
  }
  
  const handle = Math.floor(decimalPrice);
  const fractionalPart = decimalPrice - handle;
  
  // Convert to 32nds
  const thirtySecondsExact = fractionalPart * 32;
  const thirtySeconds = Math.floor(thirtySecondsExact);
  const remainder = thirtySecondsExact - thirtySeconds;
  
  // Format the 32nds part with leading zero if needed (00-31)
  const ticksStr = thirtySeconds.toString().padStart(2, '0');
  
  // Determine the fractional suffix (for 64ths and 128ths)
  let suffix = '';
  if (remainder >= 0.75 - 0.001) {
    // 3/4 of a 32nd = 3/128
    suffix = '¾';
  } else if (remainder >= 0.5 - 0.001) {
    // 1/2 of a 32nd = 1/64 (represented as "+")
    suffix = '+';
  } else if (remainder >= 0.25 - 0.001) {
    // 1/4 of a 32nd = 1/128
    suffix = '¼';
  }
  
  return `${handle}-${ticksStr}${suffix}`;
}

/**
 * Parses a Treasury 32nds formatted price string to a decimal number.
 * 
 * @param formattedPrice - The formatted price string (e.g., "99-16+")
 * @returns The decimal price value (e.g., 99.515625)
 * 
 * @example
 * parseTreasury32nds("99-16")   // 99.5
 * parseTreasury32nds("99-16+")  // 99.515625
 * parseTreasury32nds("100-00")  // 100.0
 */
export function parseTreasury32nds(formattedPrice: string): number | null {
  if (!formattedPrice || formattedPrice === '-') {
    return null;
  }
  
  // Match pattern: handle-ticks[suffix]
  const match = formattedPrice.match(/^(\d+)-(\d{2})([+¼½¾])?$/);
  if (!match) {
    return null;
  }
  
  const handle = parseInt(match[1], 10);
  const ticks = parseInt(match[2], 10);
  const suffix = match[3];
  
  let fractionalTicks = 0;
  if (suffix === '+' || suffix === '½') {
    fractionalTicks = 0.5;
  } else if (suffix === '¼') {
    fractionalTicks = 0.25;
  } else if (suffix === '¾') {
    fractionalTicks = 0.75;
  }
  
  const totalTicks = ticks + fractionalTicks;
  return handle + (totalTicks / 32);
}

/**
 * Formats a spread value in 32nds notation.
 * 
 * @param spreadDecimal - The spread as a decimal (e.g., 0.0625 = 2/32)
 * @returns Formatted spread string (e.g., "2.0/32")
 * 
 * @example
 * formatSpread32nds(0.0625)   // "2.0/32"
 * formatSpread32nds(0.03125)  // "1.0/32"
 */
export function formatSpread32nds(spreadDecimal: number | null | undefined): string {
  if (spreadDecimal == null) {
    return '-';
  }
  
  const spread32nds = spreadDecimal * 32;
  return `${spread32nds.toFixed(1)}/32`;
}

/**
 * Formats a price change in 32nds notation.
 * 
 * @param changeDecimal - The price change as a decimal
 * @returns Formatted change string with sign (e.g., "+0-02", "-0-01")
 * 
 * @example
 * formatChange32nds(0.0625)   // "+0-02"
 * formatChange32nds(-0.03125) // "-0-01"
 */
export function formatChange32nds(changeDecimal: number | null | undefined): string {
  if (changeDecimal == null) {
    return '-';
  }
  
  const isNegative = changeDecimal < 0;
  const absValue = Math.abs(changeDecimal);
  
  const handle = Math.floor(absValue);
  const fractionalPart = absValue - handle;
  const thirtySecondsExact = fractionalPart * 32;
  const thirtySeconds = Math.round(thirtySecondsExact);
  
  const ticksStr = thirtySeconds.toString().padStart(2, '0');
  const sign = isNegative ? '-' : '+';
  
  return `${sign}${handle}-${ticksStr}`;
}

/**
 * Formats a decimal price with a specified number of decimal places.
 * Useful as a fallback when Treasury 32nds format is not needed.
 * 
 * @param decimalPrice - The decimal price to format
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted decimal string
 */
export function formatDecimalPrice(
  decimalPrice: number | null | undefined, 
  decimals: number = 4
): string {
  if (decimalPrice == null) {
    return '-';
  }
  return decimalPrice.toFixed(decimals);
}

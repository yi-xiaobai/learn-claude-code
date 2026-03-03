/**
 * Math utility functions
 */

/**
 * Returns the sum of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export function add(a, b) {
  return a + b;
}

/**
 * Returns the difference of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Difference of a and b
 */
export function subtract(a, b) {
  return a - b;
}

/**
 * Returns the product of two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export function multiply(a, b) {
  return a * b;
}

/**
 * Returns the quotient of two numbers
 * @param {number} a - Dividend
 * @param {number} b - Divisor
 * @returns {number|string} Quotient of a and b, or error message if division by zero
 */
export function divide(a, b) {
  if (b === 0) {
    return "Error: Division by zero";
  }
  return a / b;
}

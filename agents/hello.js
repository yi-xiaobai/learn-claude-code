/**
 * A simple Hello World module.
 * @module hello
 */

/**
 * Prints a greeting message to the console.
 * @returns {void}
 */
function sayHello() {
    console.log("Hello, World!");
}

/**
 * Main entry point for the Hello World program.
 * @returns {void}
 */
function main() {
    sayHello();
}

// Main guard: only run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}

export { sayHello, main };

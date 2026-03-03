/**
 * Test suite for utils module.
 */

import { capitalize, isArray, randomInt } from '../utils.js';

function testCapitalize() {
    // Test capitalizing a normal string
    const result1 = capitalize('hello');
    console.assert(result1 === 'Hello', `Expected 'Hello', got '${result1}'`);

    // Test capitalizing an empty string
    const result2 = capitalize('');
    console.assert(result2 === '', `Expected '', got '${result2}'`);

    // Test capitalizing a single character
    const result3 = capitalize('a');
    console.assert(result3 === 'A', `Expected 'A', got '${result3}'`);

    console.log('✓ capitalize tests passed');
}

function testIsArray() {
    // Test with an array
    console.assert(isArray([]) === true, 'Expected true for array');

    // Test with an object
    console.assert(isArray({}) === false, 'Expected false for object');

    // Test with a string
    console.assert(isArray('test') === false, 'Expected false for string');

    // Test with null
    console.assert(isArray(null) === false, 'Expected false for null');

    console.log('✓ isArray tests passed');
}

function testRandomInt() {
    // Test that randomInt returns integers within range
    for (let i = 0; i < 100; i++) {
        const result = randomInt(1, 10);
        console.assert(Number.isInteger(result), `Expected integer, got ${result}`);
        console.assert(result >= 1 && result <= 10, `Expected value between 1 and 10, got ${result}`);
    }

    // Test edge case: same min and max
    const result = randomInt(5, 5);
    console.assert(result === 5, `Expected 5, got ${result}`);

    console.log('✓ randomInt tests passed');
}

// Run all tests
function runAllTests() {
    console.log('Running tests...\n');
    testCapitalize();
    testIsArray();
    testRandomInt();
    console.log('\n✓ All tests passed!');
}

// Main guard
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export { testCapitalize, testIsArray, testRandomInt };

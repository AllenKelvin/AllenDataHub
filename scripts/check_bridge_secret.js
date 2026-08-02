import 'dotenv/config';

const expected = 'c1a8f3d4e5b6a7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2';
const actual = process.env.INTERNAL_BRIDGE_SECRET;

console.log('INTERNAL_BRIDGE_SECRET present:', !!actual);
console.log('Matches expected:', actual === expected);
if (actual !== expected) {
  console.log('Actual value:', actual ? actual.slice(0,8) + '...' : '<missing>');
}

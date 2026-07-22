import test from 'node:test';
import assert from 'node:assert/strict';
import { hasActiveProcessingConflict } from './orderDuplicateCheck.js';

test('pending orders do not count as active processing conflicts', () => {
  const orders = [
    { status: 'pending', phoneNumber: '0240000000' },
    { status: 'completed', phoneNumber: '0240000000' },
  ];

  assert.equal(hasActiveProcessingConflict(orders), false);
});

test('processing orders do count as active conflicts', () => {
  const orders = [
    { status: 'processing', phoneNumber: '0240000000' },
    { status: 'completed', phoneNumber: '0240000000' },
  ];

  assert.equal(hasActiveProcessingConflict(orders), true);
});

const assert = require('node:assert/strict');
const ledger = require('../../www/js/ledger.js');
assert.deepEqual(ledger.allocate(100, [1,1,1]), [34,33,33]);
assert.deepEqual(ledger.allocate(101, [1,1,1]), [34,34,33]);
console.log('Expense remainder conservation passed');

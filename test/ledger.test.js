'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var L = require('../www/js/ledger');

function sum(obj) {
  return Object.keys(obj).reduce(function (a, k) { return a + obj[k]; }, 0);
}

test('allocate never loses a cent', function () {
  assert.deepEqual(L.allocate(1000, [1, 1, 1]), [334, 333, 333]);
  assert.deepEqual(L.allocate(100, [1, 2]), [33, 67]);
  for (var total = 1; total < 500; total += 7) {
    var parts = L.allocate(total, [3, 1, 4, 1, 5]);
    assert.equal(parts.reduce(function (a, b) { return a + b; }, 0), total);
  }
  assert.throws(function () { L.allocate(100, [0, 0]); });
});

test('split types', function () {
  var base = { amount: 9000, paidBy: 'ana' };
  assert.deepEqual(L.shares(Object.assign({ split: { type: 'equal', participants: ['ana', 'ben', 'cy'] } }, base)), { ana: 3000, ben: 3000, cy: 3000 });
  assert.deepEqual(L.shares(Object.assign({ split: { type: 'exact', participants: ['ana', 'ben'], values: { ana: 2000, ben: 7000 } } }, base)), { ana: 2000, ben: 7000 });
  assert.deepEqual(L.shares(Object.assign({ split: { type: 'percent', participants: ['ana', 'ben'], values: { ana: 25, ben: 75 } } }, base)), { ana: 2250, ben: 6750 });
  assert.deepEqual(L.shares(Object.assign({ split: { type: 'shares', participants: ['ana', 'ben'], values: { ana: 1, ben: 2 } } }, base)), { ana: 3000, ben: 6000 });
});

test('split validation', function () {
  assert.throws(function () { L.shares({ amount: 100, split: { type: 'exact', participants: ['a', 'b'], values: { a: 10, b: 10 } } }); }, /add up to 20/);
  assert.throws(function () { L.shares({ amount: 100, split: { type: 'percent', participants: ['a'], values: { a: 90 } } }); }, /90%/);
  assert.throws(function () { L.shares({ amount: 0, split: { type: 'equal', participants: ['a'] } }); }, /positive/);
  assert.throws(function () { L.shares({ amount: 10, split: { type: 'equal', participants: [] } }); }, /participant/);
  assert.throws(function () { L.shares({ amount: 10, split: { type: 'magic', participants: ['a'] } }); }, /unknown/);
});

test('balances sum to zero and reflect payments', function () {
  var members = ['ana', 'ben', 'cy'];
  var expenses = [
    { amount: 6000, paidBy: 'ana', split: { type: 'equal', participants: members } },       // dinner
    { amount: 3000, paidBy: 'ben', split: { type: 'equal', participants: ['ben', 'cy'] } }   // taxi
  ];
  var bal = L.balances(members, expenses, []);
  // ana: +6000 paid - 2000 share; ben: -2000 dinner + 3000 paid - 1500 taxi; cy: -2000 - 1500
  assert.deepEqual(bal, { ana: 4000, ben: -500, cy: -3500 });
  assert.equal(sum(bal), 0);

  var after = L.balances(members, expenses, [{ from: 'cy', to: 'ana', amount: 3500 }]);
  assert.deepEqual(after, { ana: 500, ben: -500, cy: 0 });
});

test('settle produces minimal, correct transfers', function () {
  var bal = { ana: 4000, ben: 1000, cy: -5000 };
  var transfers = L.settle(bal);
  assert.deepEqual(transfers, [{ from: 'cy', to: 'ana', amount: 4000 }, { from: 'cy', to: 'ben', amount: 1000 }]);

  // Applying the transfers zeroes everyone out, for random groups too.
  for (var trial = 0; trial < 50; trial++) {
    var members = ['a', 'b', 'c', 'd', 'e', 'f'];
    var expenses = [];
    for (var i = 0; i < 10; i++) {
      var payer = members[(trial * 7 + i * 3) % members.length];
      expenses.push({ amount: 100 + ((trial + 1) * (i + 3) * 37) % 9000, paidBy: payer, split: { type: 'equal', participants: members.slice(0, 2 + (i % 5)) } });
    }
    var b = L.balances(members, expenses, []);
    var t = L.settle(b);
    assert.ok(t.length <= members.length - 1);
    var settled = L.balances(members, expenses, t);
    Object.keys(settled).forEach(function (m) { assert.equal(settled[m], 0, 'member ' + m); });
  }
  assert.deepEqual(L.settle({ a: 0, b: 0 }), []);
});

test('amount parsing and formatting', function () {
  assert.equal(L.parseAmount('12'), 1200);
  assert.equal(L.parseAmount('12.5'), 1250);
  assert.equal(L.parseAmount('$1,234.56'), 123456);
  assert.equal(L.parseAmount('1.234'), null);
  assert.equal(L.parseAmount('abc'), null);
  assert.equal(L.format(123456), '$1,234.56');
  assert.equal(L.format(-505), '-$5.05');
});

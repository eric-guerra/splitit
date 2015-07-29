/**
 * SplitIt ledger: pure functions for splitting expenses and settling debts.
 * All amounts are integer cents. Works in the browser (window.Ledger) and Node (module.exports).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) { module.exports = factory(); } else { root.Ledger = factory(); }
}(this, function () {
  'use strict';

  /** Splits `total` into integer shares proportional to `weights`, distributing leftover cents fairly. */
  function allocate(total, weights) {
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    if (sum <= 0) { throw new Error('weights must sum to more than zero'); }
    var shares = weights.map(function (w) { return Math.floor(total * w / sum); });
    var remainder = total - shares.reduce(function (a, b) { return a + b; }, 0);
    // Largest fractional parts get the leftover cents (ties go to earlier participants).
    var order = weights.map(function (w, i) { return { i: i, frac: (total * w / sum) - shares[i] }; })
      .sort(function (a, b) { return b.frac - a.frac || a.i - b.i; });
    for (var k = 0; k < remainder; k++) { shares[order[k].i] += 1; }
    return shares;
  }

  /**
   * Computes how much each participant owes for one expense.
   * expense = { amount, paidBy, split: { type: 'equal'|'exact'|'percent'|'shares', participants: [...], values?: {member: n} } }
   * Returns { member: cents }.
   */
  function shares(expense) {
    var split = expense.split || { type: 'equal' };
    var people = split.participants;
    if (!people || !people.length) { throw new Error('expense needs at least one participant'); }
    if (!Number.isInteger(expense.amount) || expense.amount <= 0) { throw new Error('amount must be a positive number of cents'); }
    var values = split.values || {};
    var result = {};
    var parts;

    switch (split.type) {
      case 'equal':
        parts = allocate(expense.amount, people.map(function () { return 1; }));
        break;
      case 'exact':
        parts = people.map(function (p) { return values[p] || 0; });
        var exactSum = parts.reduce(function (a, b) { return a + b; }, 0);
        if (exactSum !== expense.amount) { throw new Error('exact amounts add up to ' + exactSum + ', not ' + expense.amount); }
        break;
      case 'percent':
        var pct = people.map(function (p) { return values[p] || 0; });
        var pctSum = pct.reduce(function (a, b) { return a + b; }, 0);
        if (Math.abs(pctSum - 100) > 1e-9) { throw new Error('percentages add up to ' + pctSum + '%, not 100%'); }
        parts = allocate(expense.amount, pct);
        break;
      case 'shares':
        parts = allocate(expense.amount, people.map(function (p) { return values[p] || 0; }));
        break;
      default:
        throw new Error('unknown split type ' + split.type);
    }
    people.forEach(function (p, i) { result[p] = (result[p] || 0) + parts[i]; });
    return result;
  }

  /**
   * Net balance per member across expenses and recorded payments.
   * Positive = the group owes them; negative = they owe the group. Balances always sum to zero.
   */
  function balances(members, expenses, payments) {
    var bal = {};
    members.forEach(function (m) { bal[m] = 0; });
    (expenses || []).forEach(function (e) {
      bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount;
      var owed = shares(e);
      Object.keys(owed).forEach(function (m) { bal[m] = (bal[m] || 0) - owed[m]; });
    });
    (payments || []).forEach(function (p) {
      bal[p.from] = (bal[p.from] || 0) + p.amount;
      bal[p.to] = (bal[p.to] || 0) - p.amount;
    });
    return bal;
  }

  /**
   * Turns balances into a short list of transfers. Greedy: repeatedly match the largest debtor
   * with the largest creditor. This gives at most n-1 transfers, which is optimal for most groups.
   */
  function settle(bal) {
    var debtors = [], creditors = [];
    Object.keys(bal).forEach(function (m) {
      if (bal[m] < 0) { debtors.push({ m: m, amt: -bal[m] }); } else if (bal[m] > 0) { creditors.push({ m: m, amt: bal[m] }); }
    });
    var byAmount = function (a, b) { return b.amt - a.amt || (a.m < b.m ? -1 : 1); };
    var transfers = [];
    while (debtors.length && creditors.length) {
      debtors.sort(byAmount);
      creditors.sort(byAmount);
      var d = debtors[0], c = creditors[0];
      var amt = Math.min(d.amt, c.amt);
      transfers.push({ from: d.m, to: c.m, amount: amt });
      d.amt -= amt;
      c.amt -= amt;
      if (d.amt === 0) { debtors.shift(); }
      if (c.amt === 0) { creditors.shift(); }
    }
    return transfers;
  }

  /** Parses "12", "12.5", "$1,234.56" into cents; returns null if invalid. */
  function parseAmount(text) {
    var s = String(text || '').replace(/[$,\s]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(s)) { return null; }
    var parts = s.split('.');
    return parseInt(parts[0], 10) * 100 + (parts[1] ? parseInt((parts[1] + '0').slice(0, 2), 10) : 0);
  }

  function format(cents) {
    var sign = cents < 0 ? '-' : '';
    var abs = Math.abs(cents);
    return sign + '$' + Math.floor(abs / 100).toLocaleString('en-US') + '.' + ('0' + (abs % 100)).slice(-2);
  }

  return { allocate: allocate, shares: shares, balances: balances, settle: settle, parseAmount: parseAmount, format: format };
}));

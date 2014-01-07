# SplitIt

A mobile app for splitting group expenses (trips, roommates, dinners) and settling up with as few payments as possible. Built with **Ionic 1 + Cordova** on the **Firebase Realtime Database**, with live sync across everyone in the group.

> Portfolio reference implementation of a 2014 hackathon project, built using that era's stack (Ionic 1, AngularJS, Firebase JS SDK v8 namespaced API).

## Features

- Email sign-in (Firebase Auth); create groups and invite people with a 6-character code (no ambiguous 0/O/1/I characters)
- Split equally, by exact amounts, by percentages or by shares, with a **live preview** of each person's share before saving
- Balances and a **settle-up plan**: the greedy largest-debtor ↔ largest-creditor pairing needs at most n−1 transfers, and recording a payment updates everyone live
- Swipe to delete expenses; native share sheet for invites

## The ledger

[www/js/ledger.js](www/js/ledger.js) is a pure UMD module used by both the app and the Node tests:
- All money is **integer cents**. `allocate()` splits with the largest-remainder method, so $10 three ways is $3.34 / $3.33 / $3.33 and no cent is ever lost
- Exact and percentage splits are validated to add up exactly
- Balances always sum to zero; applying the settle-up transfers zeroes every member (property-tested on random groups)

## Security rules

[database.rules.json](database.rules.json): only members can read or write a group; expense amounts must be positive integer cents; `paidBy` must be a member; `createdBy` must equal the signed-in user; a payment can't be from and to the same person; invite codes are write-once.

## Run

1. Create a Firebase project, enable Email/Password auth and the Realtime Database, then deploy `database.rules.json`
2. Put your web config in `www/js/config.js`
3. `npm run serve` (browser) or `ionic cordova run android`

## Test

```bash
npm test
```

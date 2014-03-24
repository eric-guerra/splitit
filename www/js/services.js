angular.module('splitit')
  /** Wraps Firebase Auth; `ready()` resolves with the user or redirects to login. */
  .factory('Session', ['$q', '$state', '$timeout', function ($q, $state, $timeout) {
    var current = null;
    var readyDeferred = $q.defer();
    firebase.auth().onAuthStateChanged(function (user) {
      $timeout(function () {
        current = user;
        readyDeferred.resolve(user);
      });
    });
    return {
      user: function () { return current; },
      ready: function () {
        return readyDeferred.promise.then(function (user) {
          if (!user) { $state.go('login'); return $q.reject('not signed in'); }
          return user;
        });
      },
      signIn: function (email, password) { return $q.when(firebase.auth().signInWithEmailAndPassword(email, password)); },
      signUp: function (email, password, name) {
        return $q.when(firebase.auth().createUserWithEmailAndPassword(email, password)).then(function (cred) {
          return $q.when(cred.user.updateProfile({ displayName: name })).then(function () { return cred.user; });
        });
      },
      signOut: function () { return $q.when(firebase.auth().signOut()); }
    };
  }])

  /**
   * Realtime Database access. Listeners push changes into Angular via $timeout so views update live
   * when another group member adds an expense.
   */
  .factory('Groups', ['$q', '$timeout', 'Session', function ($q, $timeout, Session) {
    var db = function () { return firebase.database(); };

    function inviteCode() {
      var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
      var code = '';
      for (var i = 0; i < 6; i++) { code += alphabet[Math.floor(Math.random() * alphabet.length)]; }
      return code;
    }

    function memberRecord(user) {
      return { name: user.displayName || user.email.split('@')[0], joinedAt: firebase.database.ServerValue.TIMESTAMP };
    }

    return {
      /** Live list of the current user's groups; returns an unsubscribe function. */
      watchMine: function (onChange) {
        var uid = Session.user().uid;
        var ref = db().ref('users/' + uid + '/groups');
        var listener = ref.on('value', function (snap) {
          var ids = Object.keys(snap.val() || {});
          $q.all(ids.map(function (id) {
            return $q.when(db().ref('groups/' + id).once('value')).then(function (g) {
              var val = g.val() || {};
              return angular.extend({ id: id, memberCount: Object.keys(val.members || {}).length }, val);
            });
          })).then(onChange);
        });
        return function () { ref.off('value', listener); };
      },

      create: function (name) {
        var user = Session.user();
        var ref = db().ref('groups').push();
        var code = inviteCode();
        var updates = {};
        updates['groups/' + ref.key] = { name: name, inviteCode: code, createdAt: firebase.database.ServerValue.TIMESTAMP, members: {} };
        updates['groups/' + ref.key].members[user.uid] = memberRecord(user);
        updates['users/' + user.uid + '/groups/' + ref.key] = true;
        updates['invites/' + code] = ref.key;
        return $q.when(db().ref().update(updates)).then(function () { return ref.key; });
      },

      join: function (code) {
        var user = Session.user();
        return $q.when(db().ref('invites/' + code.toUpperCase().trim()).once('value')).then(function (snap) {
          var groupId = snap.val();
          if (!groupId) { return $q.reject(new Error('No group with that code')); }
          var updates = {};
          updates['groups/' + groupId + '/members/' + user.uid] = memberRecord(user);
          updates['users/' + user.uid + '/groups/' + groupId] = true;
          return $q.when(db().ref().update(updates)).then(function () { return groupId; });
        });
      },

      /** Live group snapshot with members, expenses and payments as arrays. */
      watch: function (groupId, onChange) {
        var ref = db().ref('groups/' + groupId);
        var listener = ref.on('value', function (snap) {
          var g = snap.val() || {};
          function list(obj) {
            return Object.keys(obj || {}).map(function (k) { return angular.extend({ id: k }, obj[k]); })
              .sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
          }
          $timeout(function () {
            onChange({ id: groupId, name: g.name, inviteCode: g.inviteCode, members: g.members || {}, expenses: list(g.expenses), payments: list(g.payments) });
          });
        });
        return function () { ref.off('value', listener); };
      },

      addExpense: function (groupId, expense) {
        Ledger.shares(expense); // validate before writing; throws with a readable message
        return $q.when(db().ref('groups/' + groupId + '/expenses').push(angular.extend({}, expense, {
          createdBy: Session.user().uid, createdAt: firebase.database.ServerValue.TIMESTAMP
        })));
      },

      deleteExpense: function (groupId, expenseId) {
        return $q.when(db().ref('groups/' + groupId + '/expenses/' + expenseId).remove());
      },

      recordPayment: function (groupId, from, to, amount) {
        return $q.when(db().ref('groups/' + groupId + '/payments').push({
          from: from, to: to, amount: amount, createdAt: firebase.database.ServerValue.TIMESTAMP
        }));
      }
    };
  }]);

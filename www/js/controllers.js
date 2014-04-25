angular.module('splitit')
  .controller('LoginCtrl', ['Session', '$state', '$ionicPopup', function (Session, $state, $ionicPopup) {
    var vm = this;
    vm.form = {};
    vm.signup = false;
    vm.submit = function () {
      var p = vm.signup ? Session.signUp(vm.form.email, vm.form.password, vm.form.name) : Session.signIn(vm.form.email, vm.form.password);
      p.then(function () { $state.go('groups'); }, function (e) { $ionicPopup.alert({ title: 'Sign in failed', template: e.message }); });
    };
  }])

  .controller('GroupsCtrl', ['$scope', 'Groups', 'Session', '$state', '$ionicPopup', function ($scope, Groups, Session, $state, $ionicPopup) {
    var vm = this;
    vm.groups = null;
    var stop = Groups.watchMine(function (groups) { vm.groups = groups; });
    $scope.$on('$destroy', stop);

    vm.create = function () {
      $scope.data = {};
      $ionicPopup.show({
        title: 'New group', template: '<input type="text" ng-model="data.name" placeholder="Trip to Austin" maxlength="60">', scope: $scope,
        buttons: [{ text: 'Cancel' }, { text: 'Create', type: 'button-balanced', onTap: function (e) { if (!$scope.data.name) { e.preventDefault(); } return $scope.data.name; } }]
      }).then(function (name) { if (name) { Groups.create(name).then(function (id) { $state.go('group', { id: id }); }); } });
    };

    vm.join = function () {
      $scope.data = {};
      $ionicPopup.show({
        title: 'Join with code', template: '<input type="text" ng-model="data.code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase">', scope: $scope,
        buttons: [{ text: 'Cancel' }, { text: 'Join', type: 'button-balanced', onTap: function () { return $scope.data.code; } }]
      }).then(function (code) {
        if (!code) { return; }
        Groups.join(code).then(function (id) { $state.go('group', { id: id }); }, function (e) { $ionicPopup.alert({ title: 'Oops', template: e.message }); });
      });
    };

    vm.signOut = function () { Session.signOut().then(function () { $state.go('login'); }); };
  }])

  .controller('GroupCtrl', ['$scope', '$stateParams', 'Groups', 'Session', '$ionicPopup', function ($scope, $stateParams, Groups, Session, $ionicPopup) {
    var vm = this;
    vm.me = Session.user().uid;
    vm.tab = 'expenses';

    var stop = Groups.watch($stateParams.id, function (group) {
      vm.group = group;
      var ids = Object.keys(group.members);
      vm.balances = Ledger.balances(ids, group.expenses, group.payments);
      vm.transfers = Ledger.settle(vm.balances);
      vm.myBalance = vm.balances[vm.me] || 0;
    });
    $scope.$on('$destroy', stop);

    vm.name = function (uid) { return vm.group && vm.group.members[uid] ? vm.group.members[uid].name : 'Someone'; };

    vm.markPaid = function (t) {
      $ionicPopup.confirm({ title: 'Record payment', template: vm.name(t.from) + ' paid ' + vm.name(t.to) + ' ' + Ledger.format(t.amount) + '?' })
        .then(function (ok) { if (ok) { Groups.recordPayment(vm.group.id, t.from, t.to, t.amount); } });
    };

    vm.remove = function (expense) {
      $ionicPopup.confirm({ title: 'Delete expense?', template: expense.description }).then(function (ok) {
        if (ok) { Groups.deleteExpense(vm.group.id, expense.id); }
      });
    };

    vm.share = function () {
      var text = 'Join "' + vm.group.name + '" on SplitIt with code ' + vm.group.inviteCode;
      if (window.plugins && window.plugins.socialsharing) { window.plugins.socialsharing.share(text); } else { $ionicPopup.alert({ title: 'Invite code', template: '<h2 class="center">' + vm.group.inviteCode + '</h2>' }); }
    };
  }])

  .controller('ExpenseCtrl', ['$stateParams', 'Groups', 'Session', '$ionicHistory', '$ionicPopup', '$scope', function ($stateParams, Groups, Session, $ionicHistory, $ionicPopup, $scope) {
    var vm = this;
    var groupId = $stateParams.id;
    vm.form = { description: '', amount: '', paidBy: Session.user().uid, type: 'equal', values: {}, included: {} };

    var stop = Groups.watch(groupId, function (group) {
      vm.members = Object.keys(group.members).map(function (uid) { return { uid: uid, name: group.members[uid].name }; });
      vm.members.forEach(function (m) { if (vm.form.included[m.uid] === undefined) { vm.form.included[m.uid] = true; } });
    });
    $scope.$on('$destroy', stop);

    function participants() { return (vm.members || []).filter(function (m) { return vm.form.included[m.uid]; }).map(function (m) { return m.uid; }); }

    function buildExpense() {
      var amount = Ledger.parseAmount(vm.form.amount);
      if (!amount) { throw new Error('Enter an amount like 24.50'); }
      var values = {};
      participants().forEach(function (uid) {
        var raw = vm.form.values[uid];
        values[uid] = vm.form.type === 'exact' ? Ledger.parseAmount(raw) || 0 : parseFloat(raw) || 0;
      });
      return {
        description: vm.form.description || 'Expense', amount: amount, paidBy: vm.form.paidBy,
        split: { type: vm.form.type, participants: participants(), values: vm.form.type === 'equal' ? null : values }
      };
    }

    /** Live preview of who owes what, so users catch mistakes before saving. */
    vm.preview = function () {
      try {
        var owed = Ledger.shares(buildExpense());
        vm.previewError = null;
        return owed;
      } catch (e) {
        vm.previewError = e.message;
        return {};
      }
    };

    vm.save = function () {
      try {
        Groups.addExpense(groupId, buildExpense()).then(function () { $ionicHistory.goBack(); });
      } catch (e) {
        $ionicPopup.alert({ title: 'Check the split', template: e.message });
      }
    };
  }]);

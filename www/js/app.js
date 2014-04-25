angular.module('splitit', ['ionic'])
  .run(['$ionicPlatform', function ($ionicPlatform) {
    firebase.initializeApp(window.SPLITIT_FIREBASE);
    $ionicPlatform.ready(function () {
      if (window.StatusBar) { window.StatusBar.styleLightContent(); }
    });
  }])

  .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
    function requireUser(Session) { return Session.ready(); }
    requireUser.$inject = ['Session'];

    $stateProvider
      .state('login', { url: '/login', templateUrl: 'templates/login.html', controller: 'LoginCtrl as vm' })
      .state('groups', { url: '/groups', templateUrl: 'templates/groups.html', controller: 'GroupsCtrl as vm', resolve: { user: requireUser } })
      .state('group', { url: '/groups/:id', templateUrl: 'templates/group.html', controller: 'GroupCtrl as vm', resolve: { user: requireUser } })
      .state('expense', { url: '/groups/:id/expense', templateUrl: 'templates/expense.html', controller: 'ExpenseCtrl as vm', resolve: { user: requireUser } });
    $urlRouterProvider.otherwise('/groups');
  }])

  .filter('money', function () { return function (cents) { return Ledger.format(cents || 0); }; })
  .filter('abs', function () { return function (n) { return Math.abs(n); }; });

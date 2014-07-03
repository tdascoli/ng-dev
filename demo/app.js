'use strict';

(function(){
    var as = angular.module('dev', ['ng-dev', 'ngRoute']);

    as.controller("TestCtrl", function() {

    });


    as.config(function($routeProvider,$httpProvider){
       $httpProvider.defaults.headers.useXDomain=true;
        delete $httpProvider.defaults.headers.common['X-Requested-With'];
    });

    as.config(function (hljsServiceProvider) {
        hljsServiceProvider.setOptions({
            // replace tab with 4 spaces
            tabReplace: '    '
        });
    });

    as.run(function($rootScope, $http, $window){

    });
}());
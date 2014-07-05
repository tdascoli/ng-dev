;(function(){

    'use strict';

    var module = angular.module('ng-dev', []);

        // hljs
    module.provider('hljsService', function () {
            var _hljsOptions = {};

            return {
                setOptions: function (options) {
                    angular.extend(_hljsOptions, options);
                },
                getOptions: function () {
                    return angular.copy(_hljsOptions);
                },
                $get: ['$window', function ($window) {
                    ($window.hljs.configure || angular.noop)(_hljsOptions);
                    return $window.hljs;
                }]
            };
        });

    module.factory('hljsCache', [
            '$cacheFactory',
            function ($cacheFactory) {
                return $cacheFactory('hljsCache');
            }]);

    module.controller('HljsCtrl', [
            'hljsCache', 'hljsService',
            function HljsCtrl(hljsCache, hljsService) {
                var ctrl = this;

                var _elm = null,
                    _lang = null,
                    _code = null,
                    _hlCb = null;

                ctrl.init = function (codeElm) {
                    _elm = codeElm;
                };

                ctrl.setLanguage = function (lang) {
                    _lang = lang;

                    if (_code) {
                        ctrl.highlight(_code);
                    }
                };

                ctrl.highlightCallback = function (cb) {
                    _hlCb = cb;
                };

                ctrl.highlight = function (code) {
                    if (!_elm) {
                        return;
                    }

                    var res, cacheKey;

                    _code = code;

                    if (_lang) {
                        // language specified
                        cacheKey = ctrl._cacheKey(_lang, _code);
                        res = hljsCache.get(cacheKey);

                        if (!res) {
                            res = hljsService.highlight(_lang, hljsService.fixMarkup(_code), true);
                            hljsCache.put(cacheKey, res);
                        }
                    }
                    else {
                        // language auto-detect
                        cacheKey = ctrl._cacheKey(_code);
                        res = hljsCache.get(cacheKey);

                        if (!res) {
                            res = hljsService.highlightAuto(hljsService.fixMarkup(_code));
                            hljsCache.put(cacheKey, res);
                        }
                    }

                    _elm.html(res.value);

                    if (_hlCb !== null && angular.isFunction(_hlCb)) {
                        _hlCb();
                    }
                };

                ctrl.clear = function () {
                    if (!_elm) {
                        return;
                    }
                    _code = null;
                    _elm.text('');
                };

                ctrl.release = function () {
                    _elm = null;
                };

                ctrl._cacheKey = function () {
                    var args = Array.prototype.slice.call(arguments),
                        glue = "!angular-highlightjs!";
                    return args.join(glue);
                };
            }]);

    module.directive('highlight', ['$compile', function ($compile) {
            return {
                priority: 110,
                restrict: 'EA',
                controller: 'HljsCtrl',
                compile: function (element, attrs) {
                    var clone;
                    if (attrs.highlight==="this"){
                        clone = element.clone();
                        clone.addClass("highlight");
                        element.addClass("example");
                    }
                    else {
                        clone = element.clone();
                    }
                    //element.append(angular.element('<p class="show-code"><button type="button" class="close text-close">&lt;code/&gt;</button></p>'));

                    // get static code
                    // strip the starting "new line" character
                    var staticCode = clone[0].innerHTML.replace(/^(\r\n|\r|\n)/m, '');

                    // put template
                    clone.html('<pre><code class="hljs"></code></pre>');

                    return function postLink(scope, element, attrs, ctrl) {
                        ctrl.init(clone.find('code'));

                        if (attrs.onhighlight) {
                            ctrl.highlightCallback(function () {
                                scope.$eval(attrs.onhighlight);
                            });
                        }
                        if (attrs.highlightPlnkr!==undefined){
                            element.prepend(angular.element('<p class="show-code"><a href="http://plnkr.co/edit/pmSaK7dXYD5KVcg2dmd4?p=info" target="_blank" class="close text-close">edit in plunkr</a></p>'));
                        }
                        if (staticCode) {
                            ctrl.highlight(staticCode);
                            if (attrs.highlight==="this"){
                                element.after(clone);
                                if (attrs.highlightModel!==undefined){
                                    var modelLayer=angular.element('<pre>Model: {{'+attrs.highlightModel+' | json}}</pre>');
                                    modelLayer.addClass("model");
                                    $compile(modelLayer)(scope);
                                    element.after(modelLayer);
                                }
                            }
                            else {
                                element.replaceWith(clone);
                            }
                        }

                        scope.$on('$destroy', function () {
                            ctrl.release();
                        });
                    };
                }
            };
        }]);

    module.directive('language', [function () {
            return {
                require: 'highlight',
                restrict: 'A',
                link: function (scope, iElm, iAttrs, ctrl) {

                    iAttrs.$observe('language', function (lang) {
                        if (angular.isDefined(lang)) {
                            ctrl.setLanguage(lang);
                        }
                    });
                }
            };
        }]);

    module.directive('source', [function () {
            return {
                require: 'highlight',
                restrict: 'A',
                link: function (scope, iElm, iAttrs, ctrl) {
                    scope.$watch(iAttrs.source, function (newCode) {
                        if (newCode) {
                            ctrl.highlight(newCode);
                        }
                        else {
                            ctrl.clear();
                        }
                    });
                }
            };
        }]);

    module.directive('include', [
            '$http', '$templateCache', '$q',
            function ($http, $templateCache, $q) {
                return {
                    require: 'highlight',
                    restrict: 'A',
                    compile: function (tElm, tAttrs) {
                        var srcExpr = tAttrs.include;

                        return function postLink(scope, iElm, iAttrs, ctrl) {
                            var changeCounter = 0;

                            scope.$watch(srcExpr, function (src) {
                                var thisChangeId = ++changeCounter;

                                if (src && angular.isString(src)) {
                                    var templateCachePromise, dfd;

                                    templateCachePromise = $templateCache.get(src);
                                    if (!templateCachePromise) {
                                        dfd = $q.defer();
                                        $http.get(src, {
                                            cache: $templateCache,
                                            transformResponse: function (data) {
                                                // Return the raw string, so $http doesn't parse it
                                                // if it's json.
                                                return data;
                                            }
                                        }).success(function (code) {
                                                if (thisChangeId !== changeCounter) {
                                                    return;
                                                }
                                                dfd.resolve(code);
                                            }).error(function () {
                                                if (thisChangeId === changeCounter) {
                                                    ctrl.clear();
                                                }
                                                dfd.resolve();
                                            });
                                        templateCachePromise = dfd.promise;
                                    }

                                    $q.when(templateCachePromise)
                                        .then(function (code) {
                                            if (!code) {
                                                return;
                                            }

                                            // $templateCache from $http
                                            if (angular.isArray(code)) {
                                                // 1.1.5
                                                code = code[1];
                                            }
                                            else if (angular.isObject(code)) {
                                                // 1.0.7
                                                code = code.data;
                                            }

                                            code = code.replace(/^(\r\n|\r|\n)/m, '');
                                            ctrl.highlight(code);
                                        });
                                }
                                else {
                                    ctrl.clear();
                                }
                            });
                        };
                    }
                };
            }]);

}());

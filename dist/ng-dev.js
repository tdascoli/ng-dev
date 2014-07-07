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
                    if (attrs.id!==undefined){
                        clone.attr("id","show-"+attrs.id);
                        clone.addClass("collapse");
                        if (attrs.highlightCode!=='hide'){
                            clone.addClass("in");
                        }
                        element.append(angular.element('<p class="show-code"><button type="button" data-toggle="collapse" data-target="#show-'+attrs.id+'" class="close text-close">code</button></p>'));
                    }

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
                            element.prepend(angular.element('<p class="show-code"><a href="'+attrs.highlightPlnkr+'" target="_blank" class="close text-close">edit in plunkr</a></p>'));
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

    // placeholder
    module.directive( 'phImg', function () {
        return {
            restrict: 'A',
            scope: { dimensions: '@phImg' },
            link: function( scope, element, attr ) {
                // A reference to a canvas that we can reuse
                var canvas;

                /**
                 * The configurable parameters of the placeholder image.
                 *
                 * TODO: make configurable
                 * TODO: make defaultable
                 */
                var config = {
                    text_size: 10,
                    fill_color: '#EEEEEE',
                    text_color: '#AAAAAA'
                };

                if (attr.phImgFill!==undefined){
                    config.fill_color="#"+attr.phImgFill;
                }

                if (attr.phImgText!==undefined){
                    config.text_color="#"+attr.phImgText;
                }

                /**
                 * When the provided dimensions change, re-pull the width and height and
                 * then redraw the image.
                 */
                scope.$watch('dimensions', function () {
                    if( ! angular.isDefined( scope.dimensions ) ) {
                        return;
                    }
                    var matches = scope.dimensions.match( /^(\d+)x(\d+)$/ ),
                        dataUrl;

                    if(  ! matches ) {
                        console.error("Expected '000x000'. Got " + scope.dimensions);
                        return;
                    }

                    // Grab the provided dimensions.
                    scope.size = { w: matches[1], h: matches[2] };

                    // FIXME: only add these if not already present
                    element.prop( "title", scope.dimensions );
                    element.prop( "alt", scope.dimensions );

                    // And draw the image, getting the returned data URL.
                    dataUrl = drawImage();

                    // If this is an `img` tag, set the src as the data URL. Else, we set
                    // the CSS `background-image` property to same.
                    if ( element.prop( "tagName" ) === "IMG" ) {
                        element.prop( 'src', dataUrl );
                    } else {
                        element.css( 'background-image', 'url("' + dataUrl + '")' );
                    }
                });

                /**
                 * Calculate the maximum height of the text we can draw, based on the
                 * requested dimensions of the image.
                 */
                function getTextSize() {
                    var dimension_arr = [scope.size.h, scope.size.w].sort(),
                        maxFactor = Math.round(dimension_arr[1] / 16);

                    return Math.max(config.text_size, maxFactor);
                }

                /**
                 * Using the HTML5 canvas API, draw a placeholder image of the requested
                 * size with text centered vertically and horizontally that specifies its
                 * dimensions. Returns the data URL that can be used as an `img`'s `src`
                 * attribute.
                 */
                function drawImage() {
                    // Create a new canvas if we don't already have one. We reuse the canvas
                    // when if gets redrawn so as not to be wasteful.
                    canvas = canvas || document.createElement( 'canvas' );

                    // Obtain a 2d drawing context on which we can add the placeholder
                    // image.
                    var context = canvas.getContext( '2d' ),
                        text_size,
                        text;

                    // Set the canvas to the appropriate size.
                    canvas.width = scope.size.w;
                    canvas.height = scope.size.h;

                    // Draw the placeholder image square.
                    // TODO: support other shapes
                    // TODO: support configurable colors
                    context.fillStyle = config.fill_color;
                    context.fillRect( 0, 0, scope.size.w, scope.size.h );

                    // Add the dimension text.
                    // TODO: support configurable font
                    // FIXME: ensure text will fit and resize if it doesn't
                    text_size = getTextSize();
                    text = scope.dimensions;
                    context.fillStyle = config.text_color;
                    context.textAlign = 'center';
                    context.textBaseline = 'middle';
                    context.font = 'bold '+text_size+'pt sans-serif';

                    // If the text is too long to fit, reduce it until it will.
                    if (context.measureText( text ).width / scope.size.w > 1) {
                        text_size = config.text_size / (context.measureText( text ).width / scope.size.w);
                        context.font = 'bold '+text_size+'pt sans-serif';
                    }

                    // Finally, draw the text in its calculated position.
                    context.fillText( scope.dimensions, scope.size.w / 2, scope.size.h / 2 );

                    // Get the data URL and return it.
                    return canvas.toDataURL("image/png");
                }
            }
        };
    });

    module.factory( 'TextGeneratorService', function () {
        var words = ["lorem", "ipsum", "dolor", "sit", "amet,", "consectetur", "adipiscing",
            "elit", "ut", "aliquam,", "purus", "sit", "amet", "luctus", "venenatis,",
            "lectus", "magna", "fringilla", "urna,", "porttitor", "rhoncus", "dolor",
            "purus", "non", "enim", "praesent", "elementum", "facilisis", "leo,", "vel",
            "fringilla", "est", "ullamcorper", "eget", "nulla", "facilisi", "etiam",
            "dignissim", "diam", "quis", "enim", "lobortis", "scelerisque", "fermentum",
            "dui", "faucibus", "in", "ornare", "quam", "viverra", "orci", "sagittis", "eu",
            "volutpat", "odio", "facilisis", "mauris", "sit", "amet", "massa", "vitae",
            "tortor", "condimentum", "lacinia", "quis", "vel", "eros", "donec", "ac",
            "odio", "tempor", "orci", "dapibus", "ultrices", "in", "iaculis", "nunc",
            "sed", "augue", "lacus,", "viverra", "vitae", "congue", "eu,", "consequat",
            "ac", "felis", "donec", "et", "odio", "pellentesque", "diam", "volutpat",
            "commodo", "sed", "egestas", "egestas", "fringilla", "phasellus", "faucibus",
            "scelerisque", "eleifend", "donec", "pretium", "vulputate", "sapien", "nec",
            "sagittis", "aliquam", "malesuada", "bibendum", "arcu", "vitae", "elementum",
            "curabitur", "vitae", "nunc", "sed", "velit", "dignissim", "sodales", "ut",
            "eu", "sem", "integer", "vitae", "justo", "eget", "magna", "fermentum",
            "iaculis", "eu", "non", "diam", "phasellus", "vestibulum", "lorem", "sed",
            "risus", "ultricies", "tristique", "nulla", "aliquet", "enim", "tortor,", "at",
            "auctor", "urna", "nunc", "id", "cursus", "metus", "aliquam", "eleifend", "mi",
            "in", "nulla", "posuere", "sollicitudin", "aliquam", "ultrices", "sagittis",
            "orci,", "a", "scelerisque", "purus", "semper", "eget", "duis", "at", "tellus",
            "at", "urna", "condimentum", "mattis", "pellentesque", "id", "nibh", "tortor,",
            "id", "aliquet", "lectus", "proin", "nibh", "nisl,", "condimentum", "id",
            "venenatis", "a,", "condimentum", "vitae", "sapien", "pellentesque",
            "habitant", "morbi", "tristique", "senectus", "et", "netus", "et", "malesuada",
            "fames", "ac", "turpis", "egestas", "sed", "tempus,", "urna", "et", "pharetra",
            "pharetra,", "massa", "massa", "ultricies", "mi,", "quis", "hendrerit",
            "dolor", "magna", "eget", "est", "lorem", "ipsum", "dolor", "sit", "amet,",
            "consectetur", "adipiscing", "elit", "pellentesque", "habitant", "morbi",
            "tristique", "senectus", "et", "netus", "et", "malesuada", "fames", "ac",
            "turpis", "egestas", "integer", "eget", "aliquet", "nibh", "praesent",
            "tristique", "magna", "sit", "amet", "purus", "gravida", "quis", "blandit",
            "turpis", "cursus", "in", "hac", "habitasse", "platea", "dictumst", "quisque",
            "sagittis,", "purus", "sit", "amet", "volutpat", "consequat,", "mauris",
            "nunc", "congue", "nisi,", "vitae", "suscipit", "tellus", "mauris", "a",
            "diam", "maecenas", "sed", "enim", "ut", "sem", "viverra", "aliquet", "eget",
            "sit", "amet", "tellus", "cras", "adipiscing", "enim", "eu", "turpis",
            "egestas", "pretium", "aenean", "pharetra,", "magna", "ac", "placerat",
            "vestibulum,", "lectus", "mauris", "ultrices", "eros,", "in", "cursus",
            "turpis", "massa", "tincidunt", "dui", "ut", "ornare", "lectus", "sit", "amet",
            "est", "placerat", "in", "egestas", "erat", "imperdiet", "sed", "euismod",
            "nisi", "porta", "lorem", "mollis", "aliquam", "ut", "porttitor", "leo", "a",
            "diam", "sollicitudin", "tempor", "id", "eu", "nisl", "nunc", "mi", "ipsum,",
            "faucibus", "vitae", "aliquet", "nec,", "ullamcorper", "sit", "amet", "risus",
            "nullam", "eget", "felis", "eget", "nunc", "lobortis", "mattis", "aliquam",
            "faucibus", "purus", "in", "massa", "tempor", "nec", "feugiat", "nisl",
            "pretium", "fusce", "id", "velit", "ut", "tortor", "pretium", "viverra",
            "suspendisse", "potenti", "nullam", "ac", "tortor", "vitae", "purus",
            "faucibus", "ornare", "suspendisse", "sed", "nisi", "lacus,", "sed", "viverra",
            "tellus", "in", "hac", "habitasse", "platea", "dictumst", "vestibulum",
            "rhoncus", "est", "pellentesque", "elit", "ullamcorper", "dignissim", "cras",
            "tincidunt", "lobortis", "feugiat", "vivamus", "at", "augue", "eget", "arcu",
            "dictum", "varius", "duis", "at", "consectetur", "lorem", "donec", "massa",
            "sapien,", "faucibus", "et", "molestie", "ac,", "feugiat", "sed", "lectus",
            "vestibulum", "mattis", "ullamcorper", "velit", "sed", "ullamcorper", "morbi",
            "tincidunt", "ornare", "massa,", "eget", "egestas", "purus", "viverra",
            "accumsan", "in", "nisl", "nisi,", "scelerisque", "eu", "ultrices", "vitae,",
            "auctor", "eu", "augue", "ut", "lectus", "arcu,", "bibendum", "at", "varius",
            "vel,", "pharetra", "vel", "turpis", "nunc", "eget", "lorem", "dolor,", "sed",
            "viverra", "ipsum", "nunc", "aliquet", "bibendum", "enim,", "facilisis",
            "gravida", "neque", "convallis", "a", "cras", "semper", "auctor", "neque,",
            "vitae", "tempus", "quam", "pellentesque", "nec", "nam", "aliquam", "sem",
            "et", "tortor", "consequat", "id", "porta", "nibh", "venenatis", "cras", "sed",
            "felis", "eget", "velit", "aliquet", "sagittis", "id", "consectetur", "purus",
            "ut", "faucibus", "pulvinar", "elementum", "integer", "enim", "neque,",
            "volutpat", "ac", "tincidunt", "vitae,", "semper", "quis", "lectus", "nulla",
            "at", "volutpat", "diam", "ut", "venenatis", "tellus", "in", "metus",
            "vulputate", "eu", "scelerisque", "felis", "imperdiet", "proin", "fermentum",
            "leo", "vel", "orci", "porta", "non", "pulvinar", "neque", "laoreet",
            "suspendisse", "interdum", "consectetur", "libero,", "id", "faucibus", "nisl",
            "tincidunt", "eget", "nullam", "non", "nisi", "est,", "sit", "amet",
            "facilisis", "magna", "etiam", "tempor,", "orci", "eu", "lobortis",
            "elementum,", "nibh", "tellus", "molestie", "nunc,", "non", "blandit", "massa",
            "enim", "nec", "dui", "nunc", "mattis", "enim", "ut", "tellus", "elementum",
            "sagittis", "vitae", "et", "leo", "duis", "ut", "diam", "quam", "nulla",
            "porttitor", "massa", "id", "neque", "aliquam", "vestibulum", "morbi",
            "blandit", "cursus", "risus,", "at", "ultrices", "mi", "tempus", "imperdiet",
            "nulla", "malesuada", "pellentesque", "elit", "eget", "gravida", "cum",
            "sociis", "natoque", "penatibus", "et", "magnis", "dis", "parturient",
            "montes,", "nascetur", "ridiculus", "mus", "mauris", "vitae", "ultricies",
            "leo", "integer", "malesuada", "nunc", "vel", "risus", "commodo", "viverra",
            "maecenas", "accumsan,", "lacus", "vel", "facilisis", "volutpat,", "est",
            "velit", "egestas", "dui,", "id", "ornare", "arcu", "odio", "ut", "sem",
            "nulla", "pharetra", "diam", "sit", "amet", "nisl", "suscipit", "adipiscing",
            "bibendum", "est", "ultricies", "integer", "quis", "auctor", "elit", "sed",
            "vulputate", "mi", "sit", "amet", "mauris", "commodo", "quis", "imperdiet",
            "massa", "tincidunt", "nunc", "pulvinar", "sapien", "et", "ligula",
            "ullamcorper", "malesuada", "proin", "libero", "nunc,", "consequat",
            "interdum", "varius", "sit", "amet,", "mattis", "vulputate", "enim", "nulla",
            "aliquet", "porttitor", "lacus,", "luctus", "accumsan", "tortor", "posuere",
            "ac", "ut", "consequat", "semper", "viverra", "nam", "libero", "justo,",
            "laoreet", "sit", "amet", "cursus", "sit", "amet,", "dictum", "sit", "amet",
            "justo", "donec", "enim", "diam,", "vulputate", "ut", "pharetra", "sit",
            "amet,", "aliquam", "id", "diam", "maecenas", "ultricies", "mi", "eget",
            "mauris", "pharetra", "et", "ultrices", "neque", "ornare", "aenean", "euismod",
            "elementum", "nisi,", "quis", "eleifend", "quam", "adipiscing", "vitae",
            "proin", "sagittis,", "nisl", "rhoncus", "mattis", "rhoncus,", "urna", "neque",
            "viverra", "justo,", "nec", "ultrices", "dui", "sapien", "eget", "mi", "proin",
            "sed", "libero", "enim,", "sed", "faucibus", "turpis", "in", "eu", "mi",
            "bibendum", "neque", "egestas", "congue", "quisque", "egestas", "diam", "in",
            "arcu", "cursus", "euismod", "quis", "viverra", "nibh", "cras", "pulvinar",
            "mattis", "nunc,", "sed", "blandit", "libero", "volutpat", "sed", "cras",
            "ornare", "arcu", "dui", "vivamus", "arcu", "felis,", "bibendum", "ut",
            "tristique", "et,", "egestas", "quis", "ipsum", "suspendisse", "ultrices",
            "fusce", "ut", "placerat", "orci", "nulla", "pellentesque",
            "dignissim", "enim,", "sit", "amet", "venenatis", "urna", "cursus", "eget",
            "nunc", "scelerisque", "viverra", "mauris,", "in", "aliquam", "sem",
            "fringilla", "ut", "morbi", "tincidunt", "augue", "interdum", "velit",
            "euismod", "in", "pellentesque", "massa", "placerat", "duis", "ultricies",
            "lacus", "sed", "turpis", "tincidunt", "id", "aliquet", "risus", "feugiat",
            "in", "ante", "metus,", "dictum", "at", "tempor", "commodo,", "ullamcorper",
            "a", "lacus", "vestibulum", "sed", "arcu", "non", "odio", "euismod", "lacinia",
            "at", "quis", "risus", "sed", "vulputate", "odio", "ut", "enim", "blandit",
            "volutpat", "maecenas", "volutpat", "blandit", "aliquam", "etiam", "erat",
            "velit,", "scelerisque", "in", "dictum", "non,", "consectetur", "a", "erat",
            "nam", "at", "lectus", "urna", "duis", "convallis", "convallis", "tellus,",
            "id", "interdum", "velit", "laoreet", "id", "donec", "ultrices", "tincidunt",
            "arcu,", "non", "sodales", "neque", "sodales", "ut", "etiam", "sit", "amet",
            "nisl", "purus,", "in", "mollis", "nunc", "sed", "id", "semper", "risus", "in",
            "hendrerit", "gravida", "rutrum", "quisque", "non", "tellus", "orci,", "ac",
            "auctor", "augue", "mauris", "augue", "neque,", "gravida", "in", "fermentum",
            "et,", "sollicitudin", "ac", "orci", "phasellus", "egestas", "tellus",
            "rutrum", "tellus", "pellentesque", "eu", "tincidunt", "tortor", "aliquam",
            "nulla", "facilisi", "cras", "fermentum,", "odio", "eu", "feugiat", "pretium,",
            "nibh", "ipsum", "consequat", "nisl,", "vel", "pretium", "lectus", "quam",
            "id", "leo", "in", "vitae", "turpis", "massa", "sed", "elementum", "tempus",
            "egestas", "sed", "sed", "risus", "pretium", "quam", "vulputate", "dignissim",
            "suspendisse", "in", "est", "ante", "in", "nibh", "mauris,", "cursus",
            "mattis", "molestie", "a,", "iaculis", "at", "erat", "pellentesque",
            "adipiscing", "commodo", "elit,", "at", "imperdiet", "dui", "accumsan", "sit",
            "amet", "nulla", "facilisi", "morbi", "tempus", "iaculis", "urna,", "id",
            "volutpat", "lacus", "laoreet", "non", "curabitur", "gravida", "arcu", "ac",
            "tortor", "dignissim", "convallis", "aenean", "et", "tortor", "at", "risus",
            "viverra", "adipiscing", "at", "in", "tellus", "integer", "feugiat",
            "scelerisque", "varius", "morbi", "enim", "nunc,", "faucibus", "a",
            "pellentesque", "sit", "amet,", "porttitor", "eget", "dolor", "morbi", "non",
            "arcu", "risus,", "quis", "varius", "quam", "quisque", "id", "diam", "vel",
            "quam", "elementum", "pulvinar", "etiam", "non", "quam", "lacus",
            "suspendisse", "faucibus", "interdum", "posuere", "lorem", "ipsum", "dolor",
            "sit", "amet,", "consectetur", "adipiscing", "elit", "duis", "tristique",
            "sollicitudin", "nibh", "sit", "amet", "commodo", "nulla", "facilisi",
            "nullam", "vehicula", "ipsum", "a", "arcu", "cursus", "vitae", "congue",
            "mauris", "rhoncus", "aenean", "vel", "elit", "scelerisque", "mauris",
            "pellentesque", "pulvinar", "pellentesque", "habitant", "morbi", "tristique",
            "senectus", "et", "netus", "et", "malesuada", "fames", "ac", "turpis",
            "egestas", "maecenas", "pharetra", "convallis", "posuere", "morbi", "leo",
            "urna,", "molestie", "at", "elementum", "eu,", "facilisis", "sed", "odio",
            "morbi", "quis", "commodo", "odio", "aenean", "sed", "adipiscing", "diam",
            "donec", "adipiscing", "tristique", "risus", "nec", "feugiat", "in",
            "fermentum", "posuere", "urna", "nec", "tincidunt", "praesent", "semper",
            "feugiat", "nibh", "sed", "pulvinar", "proin", "gravida", "hendrerit",
            "lectus", "a", "molestie", "gravida", "dictum"
        ];

        function randomInt ( min, max ) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        }

        return {
            createSentence: function ( sentenceLength ) {
                var wordIndex,
                    sentence;

                // Determine how long the sentence should be. Do it randomly if one was not
                // provided.
                sentenceLength = sentenceLength || randomInt( 5, 20 );

                // Now we determine were we are going to start in the array randomly. We
                // are just going to take a slice of the array, so we have to ensure
                // whereever we start has enough places left in the array to accommodate
                // the random sentence length from above.
                wordIndex = randomInt(0, words.length - sentenceLength - 1);

                // And pull out the words, join them together, separating words by spaces
                // (duh), and removing any commas that may appear at the end of the
                // sentence. Finally, add a period.
                sentence = words.slice(wordIndex, wordIndex + sentenceLength)
                    .join(' ')
                    .replace(/\,$/g, '') + '.';

                // Capitalize the first letter - it is a sentence, after all.
                sentence = sentence.charAt(0).toUpperCase() + sentence.slice(1);

                return sentence;
            },
            createSentences: function ( numSentences ) {
                var sentences = [],
                    i = 0;

                // Determine how many sentences we should do. Do it randomly if one was not
                // provided.
                numSentences = numSentences || randomInt( 3, 5 );

                // For each paragraph, we should generate between 3 and 5 sentences.
                for ( i = 0; i < numSentences; i++ ) {
                    sentences.push( this.createSentence() );
                }

                // And then we just return the array of sentences, concatenated with spaces.
                return sentences.join( ' ' );
            },
            createParagraph: function ( numSentences ) {
                var sentences = this.createSentences( numSentences );

                // Make the sentences into a paragraph and return.
                return "<p>" + sentences + "</p>";
            },
            createParagraphs: function ( numParagraphs, numSentences ) {
                var paragraphs = [],
                    i = 0;

                numParagraphs = numParagraphs || randomInt( 3, 7 );

                // Create the number of paragraphs requested.
                for ( i = 0; i < numParagraphs; i++ ) {
                    paragraphs.push( this.createParagraph( numSentences ) );
                }

                // Return the paragraphs, concatenated with newlines.
                return paragraphs.join( '\n' );
            }
        };
    })

    module.directive( 'phTxt', [ 'TextGeneratorService', function ( TextGeneratorService ) {
            return {
                restrict: "EA",
                controller: [ '$scope', '$element', '$attrs', function ( $scope, $element, $attrs ) {
                    var numSentences,
                        numParagraphs;

                    // Gets the number of paragraphs or sentences from the service and
                    // populates the DOM node.
                    function populate() {
                        var contents;

                        // If p or neither, then get paragraphs. Else, get sentences.
                        if ( numParagraphs || !numSentences ) {
                            contents = TextGeneratorService.createParagraphs( numParagraphs, numSentences );
                        } else {
                            contents = TextGeneratorService.createSentences( numSentences );
                        }

                        $element.html( contents );
                    }

                    $attrs.$observe( 'phTxt', function ( val ) {
                        var p_match, s_match;

                        // Pull out the matches.
                        p_match = val.match( /(\d+)p/ );
                        s_match = val.match( /(\d+)s/ );

                        // If there was a match, store the value. If there wasn't, we set the
                        // value to false to ensure no old value is kept around.
                        if ( p_match !== null ) {
                            numParagraphs = parseInt( p_match[1], 10 );
                        } else {
                            numParagraphs = false;
                        }

                        // Same for sentences...
                        if ( s_match !== null ) {
                            numSentences = parseInt( s_match[1], 10 );
                        } else {
                            numSentences = false;
                        }

                        // And populate everything.
                        populate();
                    });

                    // If nothing was passed, the $observe will never run, so we need to trigger
                    // the `populate()` manually.
                    if ( ! $attrs.phTxt ) {
                        populate();
                    }
                }]
            };
        }]);

}());

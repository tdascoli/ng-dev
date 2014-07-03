;(function () {
    "use strict";

    module.exports = function (grunt) {

        // Project configuration.
        grunt.initConfig({

            // Metadata.
            pkg: grunt.file.readJSON("package.json"),
            banner: '/* ' +
                '<%= pkg.title || pkg.name %> - <%= pkg.version %> - ' +
                '<%= grunt.template.today("yyyy-mm-dd") %> - ' +
                'Copyright (c) <%= grunt.template.today("yyyy") %> dasco.li; */\n',

            // Task configurations.
            clean: {
                all: ['dist', 'build'],
                dist: ['dist'],
                build: ['build']
            },
            copy: {
                options: {
                    banner: '<%= banner %>'
                },
                main: {
                    files: [
                        // includes files within path
                        {
                            expand: true,
                            flatten: true,
                            src: [
                                'src/js/ng-dev.js',
                                'src/css/ng-dev.css'],
                            dest: 'dist',
                            filter: 'isFile'
                        }
                    ]
                }
            },
            cssmin: {
                options: {
                    banner: '<%= banner %>'
                },
                minify: {
                    expand: true,
                    cwd: 'dist/css/',
                    src: ['**/*.css', '!*.min.css'],
                    dest: 'dist/css/',
                    ext: '.min.css'
                }
            },
            uglify: {
                options: {
                    banner: '<%= banner %>'
                },
                ngdev: {
                    files: {
                        'dist/alv-ch-ng.i18n.min.js': ['src/js/ng-dev.js']
                    }
                }
            },
            compress: {
                main: {
                    options: {
                        mode: 'gzip'
                    },
                    files: [
                        { src: ['dist/ng-dev.min.js'], dest: 'dist' }
                    ]
                }
            },
            // unit testing with jasmine
            jasmine: {
                unit: {
                    src: [
                        'src/js/*.js'
                    ],
                    options: {
                        specs: ['test/unit/**/*.unit.spec.js'],
                        helpers: 'test/unit/helpers/*.helper.js',
                        vendor: [
                            'lib/jquery/dist/jquery.js',
                            'node_modules/grunt-contrib-jasmine/vendor/jasmine-2.0.0/jasmine.js'
                        ],
                        version: '2.0.0',
                        template: require('grunt-template-jasmine-istanbul'),
                        templateOptions: {
                            coverage: 'build/coverage/coverage.json',
                            report: [
                                {
                                    type: 'html',
                                    options: {
                                        dir: 'build/coverage/reports/html'
                                    }
                                },
                                {
                                    type: 'lcov',
                                    options: {
                                        dir: 'build/coverage/reports/lcov'
                                    }
                                },
                                {
                                    type: 'text-summary'
                                }
                            ]
                        }
                    }
                }
            },
            coveralls: {
                options: {
                    // LCOV coverage file relevant to every target
                    src: '',

                    // When true, grunt-coveralls will only print a warning rather than
                    // an error, to prevent CI builds from failing unnecessarily (e.g. if
                    // coveralls.io is down). Optional, defaults to false.
                    force: false
                },
                all: {
                    src: 'build/coverage/reports/lcov/lcov.info'
                }
            },
            // integration testing with protractor
            protractor_webdriver: {
                start: {
                    options: {
                        command: 'webdriver-manager start'
                    }
                }
            },
            protractor: {
                options: {
                    keepAlive: false // If false, the grunt process stops when the test fails.
                },
                int: {
                    configFile: 'test/integration/conf/protractor.conf.js' // Target-specific config file
                }
            },
            // release mgmt
            push: {
                options: {
                    files: ['package.json'],
                    updateConfigs: [],
                    releaseBranch: 'master',
                    add: true,
                    addFiles: ['*.*', 'dist/**', 'src/**', 'test/**'], // '.' for all files except ignored files in .gitignore
                    commit: true,
                    commitMessage: 'Release v%VERSION%',
                    commitFiles: ['*.*', 'dist/**', 'src/**', 'test/**'], // '-a' for all files
                    createTag: true,
                    tagName: 'v%VERSION%',
                    tagMessage: 'Version %VERSION%',
                    push: false,
                    npm: false,
                    gitDescribeOptions: '--tags --always --abbrev=1 --dirty=-d' // options to use with '$ git describe'
                }
            },
            // linting
            jshint: {
                gruntfile: {
                    options: {
                        jshintrc: '.jshintrc'
                    },
                    src: 'Gruntfile.js'
                },
                src: {
                    options: {
                        jshintrc: '.jshintrc'
                    },
                    src: ['src/**/*.js']
                },
                test: {
                    options: {
                        jshintrc: 'test/.jshintrc'
                    },
                    src: ['test/**/*.js', '!test/dev/*.js', '!test/**/helpers/*.helper.js']
                }
            }
        });

        // These plugins provide necessary tasks.
        grunt.loadNpmTasks('grunt-contrib-clean');
        grunt.loadNpmTasks('grunt-contrib-compress');
        grunt.loadNpmTasks('grunt-contrib-concat');
        grunt.loadNpmTasks('grunt-contrib-copy');
        grunt.loadNpmTasks('grunt-contrib-cssmin');
        grunt.loadNpmTasks('grunt-contrib-jasmine');
        grunt.loadNpmTasks('grunt-contrib-jshint');
        grunt.loadNpmTasks('grunt-contrib-uglify');
        grunt.loadNpmTasks('grunt-contrib-watch');
        grunt.loadNpmTasks('grunt-push-release');
        grunt.loadNpmTasks('grunt-contrib-less');
        grunt.loadNpmTasks('grunt-protractor-runner');
        grunt.loadNpmTasks('grunt-karma');
        grunt.loadNpmTasks('grunt-exec');
        grunt.loadNpmTasks('grunt-contrib-connect');
        grunt.loadNpmTasks('grunt-protractor-webdriver');
        grunt.loadNpmTasks('grunt-coveralls');

        // Tests
        grunt.registerTask('unit-test', ['jasmine']);
        grunt.registerTask('int-test', ['protractor_webdriver:start', 'protractor']);

        // CI
        grunt.registerTask('travis', ['jshint', 'clean:build', 'unit-test', 'coveralls']);

        // Releases
        grunt.registerTask('releasePatch', ['jshint', 'clean:all', 'uglify', 'copy', 'push:patch']);
        grunt.registerTask('releaseMinor', ['jshint', 'clean:all', 'uglify', 'copy', 'less', 'push:minor']);
        grunt.registerTask('releaseMajor', ['jshint', 'clean:all', 'uglify', 'copy', 'less', 'push:major']);

        // Default task.
        grunt.registerTask('default', ['jshint', 'clean:all', 'unit-test', 'copy', 'cssmin', 'uglify', 'compress']);
    };


})();
module.exports = function (grunt) {
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-connect');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-patch');
    grunt.loadNpmTasks("grunt-update-submodules");
    grunt.loadNpmTasks('grunt-git');

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        builddir: '.',
        buildtheme: '',
        banner: '/*!\n' +
                ' * <%= pkg.name %> v<%= pkg.version %>\n' +
                ' * Homepage: <%= pkg.homepage %>\n' +
                ' * Copyright 2012-<%= grunt.template.today("yyyy") %> <%= pkg.author %>\n' +
                ' * Licensed under <%= pkg.license %>\n' +
                ' * Based on Bootstrap\n' +
                '*/\n',
        swatch: {
            amelia: {}, cerulean: {}, cosmo: {}, cyborg: {}, darkly: {},
            flatly: {}, journal: {}, lumen: {}, paper: {}, readable: {},
            sandstone: {}, simplex: {}, slate: {}, spacelab: {}, superhero: {},
            united: {}, yeti: {}, custom: {}
        },
        clean: {
            build: {
                src: ['*/build.scss', '!global/build.scss']
            }
        },
        concat: {
            options: {
                banner: '<%= banner %>',
                stripBanners: false
            },
            dist: {
                src: [],
                dest: ''
            }
        },
        sass: {
            dist: {
                options: {
                    style: 'nested'
                },
                files: {}
            }
        },
        watch: {
            files: ['*/variables.scss', '*/bootswatch.scss', '*/index.html'],
            tasks: 'build',
            options: {
                livereload: true,
                nospawn: true
            }
        },
        connect: {
            base: {
                options: {
                    port: 3000,
                    livereload: true,
                    open: true
                }
            },
            keepalive: {
                options: {
                    port: 3000,
                    livereload: true,
                    keepalive: true,
                    open: true
                }
            }
        },
        convert_less: {},
        apply_patch: {},
        update_submodules: {
            withCustomParameters: {
                options: {
                    params: "--init --recursive --force" // specifies your own command-line parameters
                }
            }
        }
    });

    grunt.registerTask('none', function () {
    });

    grunt.registerTask('build', 'build a regular theme', function (theme, compress) {
        var theme = theme == undefined ? grunt.config('buildtheme') : theme;
        var compress = compress == undefined ? true : compress;

        var isValidTheme = grunt.file.exists(theme, '_variables.scss') && grunt.file.exists(theme, '_bootswatch.scss');

        // cancel the build (without failing) if this directory is not a valid theme
        if (!isValidTheme) {
            return;
        }

        var concatSrc;
        var concatDest;
        var scssDest;
        var scssSrc;
        var files = {};
        var dist = {};
        concatSrc = 'global/build.scss';
        concatDest = theme + '/build.scss';
        scssDest = '<%=builddir%>/' + theme + '/bootstrap.css';
        scssSrc = [theme + '/' + 'build.scss'];

        dist = {src: concatSrc, dest: concatDest};
        grunt.config('concat.dist', dist);
        files = {};
        files[scssDest] = scssSrc;
        grunt.config('sass.dist.files', files);
        grunt.config('sass.dist.options.style', 'nested');

        grunt.task.run(['concat', 'sass:dist', 'clean:build',
            compress ? 'compress:' + scssDest + ':' + '<%=builddir%>/' + theme + '/bootstrap.min.css' : 'none']);
    });

    grunt.registerTask('compress', 'compress a generic css', function (fileSrc, fileDst) {
        var files = {};
        files[fileDst] = fileSrc;
        grunt.log.writeln('compressing file ' + fileSrc);

        grunt.config('sass.dist.files', files);
        grunt.config('sass.dist.options.style', 'nested');
        grunt.task.run(['sass:dist']);
    });

    grunt.registerMultiTask('swatch', 'build a theme', function () {
        var t = this.target;
        grunt.task.run('build:' + t);
    });

    /**
     * Regex borrowed form
     * https://gist.github.com/rosskevin/ddfe895091de2ca5f931
     * */
    grunt.registerTask('convert_less', 'naively convert less to scss (may require some debugging)', function () {
        var convertBaseDir = 'bootswatch/';
        grunt.file.expand(convertBaseDir + '*/*.less').forEach(function (f) {
            var srcContents = grunt.file.read(f);
            var out = srcContents
                    // 1. replace @ with $
                    .replace(/@(?!import|media|keyframes|-)/g, '$')
                    // 2. replace mixins
                    .replace(/[\.#](?![0-9])([\w\-]*)\s*\((.*)\)\s*\{/g, '@mixin $1($2){')
                    // 3. In LESS, bootstrap namespaces mixins, in SASS they are just prefixed e.g #gradient > .vertical-three-colors becomes @include gradient-vertical-three-colors
                    .replace(/[\.#](?![0-9])([\w\-]*)\s>\s\.(.*;)/g, '@include $1-$2')
                    // 4. replace includes
                    .replace(/[\.#](?![0-9])([\w\-].*\(.*;)/g, '@include $1')
                    // 5. replace no param mixin includes with empty parens
                    .replace(/@include\s([\w\-]*\s*);/g, '@include $1();')
                    // 6. replace string literals
                    .replace(/~"(.*)"/g, '#{"$1"}')
                    // 7. replace spin to adjust-hue (function name diff)
                    .replace(/spin\(/g, 'adjust-hue(')
                    // 8. replace bower and imports in build.scss
                    .replace(/bootstrap\/less\//g, 'bootstrap-sass-official/assets/stylesheets/')
                    .replace(/\.less/g, '');

            var baseDirRegex = new RegExp("^" + convertBaseDir, "g");
            var dest = f.replace(baseDirRegex, '').replace(/\.less$/, '.scss').replace(/(bootswatch|variables)/, '_$1');
            grunt.file.write(dest, out);
            grunt.log.writeln('Converted less file:', f, dest);
            var patchFile = dest.replace(/\.scss$/, '.scss.patch');
            if (grunt.file.exists(patchFile)) {
                grunt.log.writeln('   Found patch:', patchFile);
                grunt.task.run(['apply_patch:' + patchFile + ':' + dest]);
            }
            if (out.match(/\$\$/g)) {
                grunt.log.warn("This file may contain illegal variable references that will have to be manually refactored", f);
                var howto = "";
                grunt.log.warn(howto);
            }
        });
    });

    grunt.registerTask('update_html', 'Update html files replace less references with sass', function () {
        var footerText ='<p>Bootswatch SASS version made by <a href="http://gdmedia.tv" rel="nofollow">Corey Sewell</a>. Contact him at <a href="mailto:corey@gdmedia.tv">corey@gdmedia.tv</a>.</p>';
        var convertBaseDir = 'bootswatch/';
        var htmlFiles = grunt.file.expand(convertBaseDir + '*/*.html');
        htmlFiles.push(convertBaseDir+"index.html");
        htmlFiles.forEach(function (f) {
            var srcContents = grunt.file.read(f);
            var out = srcContents
                    .replace(/(.*user=)thomaspark(&repo=)bootswatch(.*)/g, '$1guru-digital$2bootswatch-sass$3')
                    .replace(/(github.com)\/thomaspark\/bootswatch(.*)/g, '$1/guru-digital/bootswatch-sass$2')
                    .replace(/LESS/g, 'SCSS')
                    .replace(/(.*)(<p>)(Made by.*<\/p>)/g, '$1'+footerText+"\n"+'$1$2Original Bootswatch $3')
                    .replace(/(bootswatch|variables)\.less/g, '_$1.scss');
            var baseDirRegex = new RegExp("^" + convertBaseDir, "g");
            var dest = f.replace(baseDirRegex, '');
            grunt.file.write(dest, out);
            grunt.log.writeln('Parsed HTML file:', f, dest);
            var patchFile = dest+'.patch';
            if (grunt.file.exists(patchFile)) {
                grunt.log.writeln('   Found patch:', patchFile);
                grunt.task.run(['apply_patch:' + patchFile + ':' + dest]);
            }
     
        });
    });

    grunt.registerTask('update_bootswatch_less', 'Update the less version submodule', function (patchFile, dest) {
        var cwd = process.cwd();

        grunt.task.run(['update_submodules']);

        grunt.config('gitpull.bootswatch.options.cwd', cwd + "/bootswatch");
        grunt.config('gitpull.bootswatch.options.remote', 'origin');
        grunt.config('gitpull.bootswatch.options.branch', 'gh-pages');
        grunt.task.run(['gitpull']);

        grunt.config('gitcheckout.bootswatch.options.cwd', cwd + "/bootswatch");
		grunt.config('gitcheckout.bootswatch.options.branch', 'gh-pages');
        grunt.task.run(['gitcheckout']);
    });

    grunt.registerTask('sync_with_upstream', 'Update bootswatch sass from the original bootswatch', function (patchFile, dest) {
        grunt.task.run(['update_bootswatch_less', 'convert_less', 'update_html', 'swatch']);
    });
    
    grunt.registerTask('create_patch', 'Creates a patch file', function (oldFile, newFile) {
      var jsdiff = require('diff');
      var patchFile = oldFile + ".patch";
      var newText = grunt.file.read(newFile);
      var oldText = grunt.file.read(oldFile);
      var diffText = jsdiff.createPatch(patchFile, oldText, newText);
      grunt.file.write(patchFile, diffText);
    });

    grunt.registerTask('apply_patch', 'apply a unified patch file', function (patchFile, dest) {
        var files = {};
        files[dest] = dest;
        grunt.config('patch.dist.options.patch', patchFile);
        grunt.config('patch.dist.files', files);
        grunt.task.run(['patch:dist']);
    });

    grunt.event.on('watch', function (action, filepath) {
        var path = require('path');
        var theme = path.dirname(filepath);
        grunt.config('buildtheme', theme);
    });

    grunt.registerTask('server', 'connect:keepalive');

    grunt.registerTask('default', ['connect:base', 'watch']);
};

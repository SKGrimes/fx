// =================================
// Explicitly Declare Gulp Plugins
// =================================
const gulp = require('gulp');
const imagemin = require('gulp-imagemin');

//const nodemon = require('gulp-nodemon');
//const plumber = require('gulp-plumber');
//const livereload = require('gulp-livereload');
const sass = require('gulp-sass');
const rubysass = require('gulp-ruby-sass');
const sourcemaps = require('gulp-sourcemaps');
const cssnano = require('gulp-cssnano');
const autoprefixer = require('gulp-autoprefixer');
const concat = require('gulp-concat');
// const uglify = require('gulp-uglify');
const babel = require('gulp-babel');
const watch = require('gulp-watch');
const batch = require('gulp-batch');
const notify = require('gulp-notify');
// =================
//  Non-Gulp & User
// =================
const path = require('path');
const config = require('./config.json');

// =================
//  Gulp Tasks
// =================
// We break out tasks for some optimizations over the foundation-cli
// and we can seperate our tasks into user && framework/vendor stuff
// so we aren't compiling like 20K LOC everytime I reload and running
// browserfy as an entire seperate complicated application to compile
// some sass.



// Copy Images
// ------------
// Literally just copies anything inside images dir.
// we go 2 deep to catch favicons
gulp.task('images', () => {
    return gulp.src('src/images/**/*')
        .pipe(imagemin())  // one of the lawyer pictures was literally 93mbs....
        .pipe(gulp.dest(path.join(config.dist, '/images')));
});

// Compiles just vendor Sass
// -------------------------
// In production, the CSS is compressed
gulp.task('vendor', () => {
    return gulp.src(config.sass.file)
        .pipe(sourcemaps.init())
        .pipe(sass({
                includePaths: config.sass.paths,
            })
            .on('error', sass.logError))
        .pipe(autoprefixer({
            browsers: ['last 2 versions', 'ie >= 9'],
        }))
        // Comment in the pipe below to run UnCSS in production
        //.pipe($.if(PRODUCTION, $.uncss(UNCSS_OPTIONS)))
        .pipe(cssnano())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(path.join(config.dist, '/stylesheets')));
});

gulp.task('js', () => {
    return gulp.src(config.javascript)
        .pipe(sourcemaps.init())
        .pipe(babel({
            presets: ['es2015'],
        }))
        .pipe(concat('app.js'))
        // .pipe(uglify()
        //   .on('error', e => { console.log(e); })
        // )
        .pipe(sourcemaps.write())
        .pipe(gulp.dest(path.join(config.dist, '/js')))
        .pipe(notify('Gulptask JS ran'));
});

// =============================
//  SASS Compiler
// =============================
// compiles the non-vendor sass

gulp.task('sass', () => {
    return rubysass(config.sass.bespoke + '/*.scss', {
        sourcemap: false,
        precision: 6,
    })
    .on('error', sass.logError)

    // For inline sourcemaps
    .pipe(sourcemaps.write())
    .pipe(gulp.dest(path.join(config.dist, '/stylesheets')))
    .pipe(notify('Gulptask SASS ran'));
});


// ================
// Watch Tasks
// ================
// we use gulp watch to process batch functions and be more robust
// than internal gulp watch method. recompiles sass on change of
// glob passed to watch e.g. watch('src/stylesheets/**/*.scss'...
gulp.task('watch', () => {
    watch(config.sass.bespoke + '/**/*.scss', batch((events, done) => {
        gulp.start('sass', done);
    }));

    // watch just user js
    watch('src/js/*.js', batch((events, done) => {
        gulp.start('js', done);
    }));
});


gulp.task('default', ['images', 'js', 'vendor', 'sass', 'watch']);

// gulp.task('develop', function () {
//   livereload.listen();
//   nodemon({
//     script: 'bin/www',
//     ext: 'js handlebars coffee',
//     stdout: false
//   }).on('readable', function () {
//     this.stdout.on('data', function (chunk) {
//       if(/^Express server listening on port/.test(chunk)){
//         livereload.changed(__dirname);
//       }
//     });
//     this.stdout.pipe(process.stdout);
//     this.stderr.pipe(process.stderr);
//   });
// });
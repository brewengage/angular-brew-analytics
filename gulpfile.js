// gulpfile.js - angular-google-analytics
var gulp = require('gulp');
var rename = require('gulp-rename');
var jshint = require('gulp-jshint');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var header = require('gulp-header');
var sequence = require('gulp-sequence');

// use data from package.json to write header 
var pkg = require('./package.json');
var banner = ['/**',
  ' * <%= pkg.name %> - <%= pkg.description %>',
  ' * @version v<%= pkg.version %>',
  ' * @link <%= pkg.homepage %>',
  ' * @author <%= pkg.author %>',
  ' * @contributors <%= pkg.contributors[0] %>',
  ' * @contributors BrewEngage (added support for ui-router)',
  ' * @license <%= pkg.license %>',
  ' */',
  '',
  ''].join('\n');

// constants
var C_FNAME        = 'angular-brew-analytics';
var C_FNAME_JS     = C_FNAME + '.js';
var C_FNAME_JS_MIN = C_FNAME + '.min.js';
var C_DIR_DIST     = './output/';

// define tasks
gulp.task('concat', function () {
  return gulp
    .src('index.js')
    .pipe(header(banner, { pkg : pkg } ))
    .pipe(concat(C_FNAME_JS))
    .pipe(gulp.dest(C_DIR_DIST))
  ;
});

gulp.task('uglify', function () {
  return gulp
    .src(C_DIR_DIST + C_FNAME_JS)
    .pipe(rename(C_FNAME_JS_MIN))
    .pipe(uglify())
    .pipe(gulp.dest(C_DIR_DIST))
  ;
});

gulp.task('jshint', function () {
  return gulp
    .src('index.js,test/*.js,test/unit/*.js')
    .pipe(jshint())
    .pipe(jshint.reporter('default'))
  ;
});

gulp.task('test', function (done) {
  karma.start(
{
  "reporters": [
    "dots"
  ],
  "singleRun": true
}
  , done);
});

gulp.task('test', function (done) {
  karma.start(
{
  "singleRun": false
}
  , done);
});


// Chain Tasks
gulp.task('default', ["build"]);

gulp.task('lint', ["jshint"]);

//gulp.task('test', ["jshint","karma:test"]);

//gulp.task('test-server', ["karma:server"]);

gulp.task('build', sequence('lint','concat','uglify'));

gulp.task('release', ["build"]);

gulp.task('dev', sequence('lint','concat'));

// END - gulpfile.js
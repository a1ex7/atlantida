/* Modules */

const gulp = require('gulp');

const browserSync = require('browser-sync').create();
const del = require('del');
const fileinclude = require('gulp-file-include');
const googleWebFonts = require('gulp-google-webfonts');

const imagemin = require('gulp-imagemin');

const notify = require('gulp-notify');
const rename = require('gulp-rename');
const sass = require('gulp-sass');
const sourcemaps = require('gulp-sourcemaps');
const svgSprite = require('gulp-svg-sprite');

const webpack = require('webpack-stream');

const postcss = require('gulp-postcss');
const autoprefixer = require('autoprefixer');
const csso = require('postcss-csso');
const mqpacker = require('css-mqpacker');

/* Configuration */

const srcPath = 'src';
const destPath = 'dist';

const cfg = {
  env: 'development',

  src: {
    root: srcPath,
    templates: `${srcPath}/templates`,
    sass: `${srcPath}/sass`,
    css: `${srcPath}/css`,
    components: `${srcPath}/components`,
    // path for sass files that will be generated automatically
    sassGen: `${srcPath}/sass/generated`,
    js: `${srcPath}/js`,
    img: `${srcPath}/img`,
    svg: `${srcPath}/img/svg`,
    fonts: `${srcPath}/fonts`,
    libs: `${srcPath}/libs`,
  },

  dest: {
    root: destPath,
    html: destPath,
    css: `${destPath}/css`,
    js: `${destPath}/js`,
    img: `${destPath}/img`,
    fonts: `${destPath}/fonts`,
    libs: `${destPath}/libs`,
  },

  setEnv(env) {
    if (typeof env !== 'string') return;
    this.env = env;
  },
};

/* ====== Tasks ====== */

/* Html with includes */

const html = () => {
  return gulp
    .src(`${cfg.src.templates}/*.html`)
    .pipe(
      fileinclude({
        prefix: '@@',
        basepath: '@file',
        indent: true,
      })
    )
    .pipe(gulp.dest(cfg.src.root))
    .pipe(browserSync.stream());
};

exports.html = html;

/* Concatenate Libs scripts and common scripts */

const js = () => {
  return gulp
    .src(`${cfg.src.js}/index.js`)
    .pipe(
      webpack({
        module: {
          rules: [
            {
              test: /\.m?js$/,
              exclude: /(node_modules|bower_components)/,
              use: {
                loader: 'babel-loader',
                options: {
                  presets: [
                    ['@babel/preset-env', {targets: cfg.browserslist}],
                  ],
                  // https://babeljs.io/docs/en/plugins
                  // plugins: ['@babel/plugin-transform-arrow-functions']
                },
              },
            },
          ],
        },
        mode: cfg.env,
        devtool: cfg.env === 'development' ? 'source-map' : 'none',
        output: {
          filename: 'app.min.js',
        },
      })
    )
    .pipe(gulp.dest(cfg.src.js))
    .pipe(browserSync.stream());
};

exports.js = js;

/* Magic with sass files */

const styles = () => {
  const plugins = [mqpacker(), autoprefixer(), csso({restructure: false})];
  return gulp
    .src(cfg.src.sass + '/main.+(sass|scss)')
    .pipe(sourcemaps.init())
    .pipe(
      sass({
        outputStyle: 'expanded',
      })
    )
    .on(
      'error',
      notify.onError({
        title: '<%= error.plugin %> in <%= error.relativePath %>',
        message: '<%= error.messageOriginal %>\nLine: <%= error.line %>, <%= error.column %>',
        sound: true,
      })
    )
    .pipe(postcss(plugins))
    .pipe(rename({suffix: '.min', prefix: ''}))
    .pipe(sourcemaps.write('/'))
    .pipe(gulp.dest(cfg.src.css))
    .pipe(browserSync.stream());
};

exports.styles = styles;

/* Browser Sync Server */

const serve = () => {
  browserSync.init({
    server: {
      baseDir: cfg.src.root,
    },
    notify: true,
    open: false,
    // proxy: 'domain.dev',
    // tunnel: true,
    // tunnel: 'projectName', //Demonstration page: http://projectName.localtunnel.me
  });
  return true;
};

exports.serve = serve;

/* Monitoring */

const watch = () => {
  gulp.watch(
    [`${cfg.src.components}/**/*.html`, `${cfg.src.templates}/**/*.html`],
    gulp.series(html)
  );
  gulp.watch(
    [
      `${cfg.src.components}/**/*.+(scss|sass)`,
      `${cfg.src.sass}/**/*.+(scss|sass)`,
    ],
    gulp.series(sass)
  );
  gulp.watch(
    [
      `${cfg.src.js}/**/*.js`,
      `${cfg.src.components}/**/*.js`,
      `!${cfg.src.js}/app.min.js`,
    ],
    gulp.series(js)
  );
  gulp.watch(`${cfg.src.svg}/**/*.svg`, gulp.series(sprites));
  gulp.watch(`${cfg.src.root}*.html`, browserSync.reload);
};

exports.watch = watch;

/* Image optimization */

const imageopt = () => {
  return gulp
    .src([cfg.src.img + '/**/*', '!' + cfg.src.img + '/sprites/**/*'])
    .pipe(
      imagemin([
        imagemin.gifsicle({interlaced: true}),
        imagemin.jpegtran({progressive: true}),
        imagemin.optipng({optimizationLevel: 5}),
        imagemin.svgo({
          plugins: [
            {
              removeViewBox: true,
              removeUselessStrokeAndFill: true,
            },
          ],
        }),
      ])
    )
    .pipe(gulp.dest(cfg.dest.img));
};

exports.imageopt = imageopt;

/* Generate SVG Sprites */

const sprites = () => {
  return gulp
    .src(cfg.src.svg + '/**/*.svg')
    .pipe(
      svgSprite({
        shape: {
          spacing: {
            padding: 0,
          },
        },
        mode: {
          view: {
            dest: 'sass',
            dimensions: true,
            bust: false,
            layout: 'diagonal',
            sprite: '../img/sprites/sprite.svg',
            render: {
              scss: {
                dest: 'generated/_sprite.scss',
                template: 'src/img/sprites/tmpl/sprite.scss',
              },
            },
            example: {
              dest: '../img/sprites/sprite.html',
            },
          },

          symbol: {
            dest: 'sass',
            bust: false,
            sprite: '../img/sprites/sprite-symbol.svg',
            prefix: '.symbol-%s',
            inline: true,
            render: {
              scss: {
                dest: 'generated/_sprite-symbol.scss',
              },
            },
            example: {
              dest: '../img/sprites/sprite-symbol.html',
            },
          },
        },
      })
    )
    .pipe(gulp.dest(cfg.src.root));
};

exports.sprites = sprites;

/* Download Google Fonts */

const options = {
  fontsDir: '../fonts/',
  cssDir: '../sass/',
  cssFilename: 'webfonts.css',
};

const fonts = () => {
  return gulp
    .src('src/fonts/fonts.list')
    .pipe(googleWebFonts(options))
    .pipe(gulp.dest(cfg.src.fonts));
};

exports.fonts = fonts;

/* Helpers */

const clean = (done) => {
  del.sync(cfg.dest.root);
  done();
};

exports.clean = clean;

/* Build project */

const build = gulp.series(
  (setEnvProduction = (done) => {
    cfg.setEnv('production');
    done();
  }),

  clean,
  sprites,
  imageopt,
  html,
  styles,
  js,

  (copyAssets = (done) => {
    const copyHtml = gulp
      .src([cfg.src.root + '/*.html'])
      .pipe(gulp.dest(cfg.dest.root));

    const copySprites = gulp
      .src([cfg.src.img + '/sprites/**/*.svg'])
      .pipe(gulp.dest(cfg.dest.img + '/sprites'));

    const copyCss = gulp
      .src([cfg.src.css + '/main.min.css'])
      .pipe(gulp.dest(cfg.dest.css));

    const copyJs = gulp
      .src([cfg.src.js + '/app.min.js'])
      .pipe(gulp.dest(cfg.dest.js));

    const copyFonts = gulp
      .src([cfg.src.fonts + '/**/*'])
      .pipe(gulp.dest(cfg.dest.fonts));

    done();
  })
);

exports.build = build;

/* Go! */

exports.default = gulp.series(
  (setEnvDevelopment = (done) => {
    cfg.setEnv('development');
    done();
  }),
  gulp.parallel(html, styles, js),
  gulp.parallel(serve, watch)
);

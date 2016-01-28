/* global __dirname */
'use strict';

var assign = require('object-assign'),
    chalk = require('chalk'),
    fs = require('fs'),
    loaderUtils = require('loader-utils'),
    path = require('path'),
    stylelint = require('stylelint');

var defaultOptions = {
    configFile: './.stylelint.config.js',
    displayOutput: true,
    ignoreCache: false
};

var lintedFiles = [];

/**
 * Lint the provided file
 */
function linter(content, options, context, callback) {
    // Figure out if we need to process this file
    var processFile = true;
    if (!options.ignoreCache) {
        var fileIndex = lintedFiles.findIndex((t) => { return t === context.resourcePath; });
        if (fileIndex === -1) {
            lintedFiles.push(context.resourcePath);
            processFile = true;
        } else {
            processFile = false;
        }
    }

    // Display Path is what we show to the user
    var filePath = context.resourcePath;
    if (filePath.indexOf(__dirname) === 0) {
        filePath = filePath.replace(__dirname, '.');
    }

    var lintOptions = assign({}, options, {
        syntax: path.extname(filePath).replace('.', ''),
        formatter: 'json'
    });

    if (processFile) {
        stylelint.lint(lintOptions)
            .then(data => {
                data.results.forEach(result => {
                    if (options.displayOutput && result.warnings.length > 0) {
                        console.log(chalk.blue.underline.bold(result.source));
                    }
                    result.warnings.forEach(warning => {
                        var position = `${warning.line}:${warning.column}`;
                        if (warning.severity === 'warning') {
                            if (options.displayOutput) {
                                console.log(chalk.yellow(`${position} ${warning.text}`));
                            }
                            if (options.webpackWarnings) {
                                context.emitWarning(`${position} ${warning.text}`);
                            }
                        } else if (warning.severity === 'error') {
                            if (options.displayOutput) {
                                console.log(chalk.red(`${position} ${warning.text}`));
                            }
                            if (options.webpackErrors) {
                                context.emitError(`${position} ${warning.text}`);
                            }
                        }
                    });
                    console.log(chalk.blue('\n Come on, fix you sass nigga (Last check: ' + new Date() + ')'));
                    if (options.displayOutput && result.warnings.length > 0) {
                        console.log('');
                    }
                });
                callback(null, content);
            });
    } else if (callback) {
        callback(null, content);
    }
}

/**
 * Webpack Loader Definition
 *
 * @param {string|buffer} content = the content to be linted
 */
module.exports = function (content) {
    this.cacheable && this.cacheable();
    var callback = this.async();

    var packOptions = this.options.stylelint || {};
    var loaderOptions = loaderUtils.parseQuery(this.query);
    var options = assign({}, defaultOptions, packOptions, loaderOptions);

    try {
        linter(content, options, this, callback);
    } catch (error) {
        console.error('[stylelint-loader] error = ', error.stack);
        callback(error);
    }
};

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
    ignoreCache: false,
    webpackWarnings: true,
    webpackErrors: true,
    files: null
};

var lintedFiles = [];

/**
 * Lint the provided file
 */
function linter(content, options, context, callback) {
    // Figure out if we need to process this file
    var processFile = true,
        importTree = false;
    if (!options.ignoreCache) {
        var fileIndex = lintedFiles.findIndex((t) => { return t === context.resourcePath; });
        if (fileIndex === -1) {
            lintedFiles.push(context.resourcePath);
            processFile = true;
        } else {
            processFile = false;
        }
    }

    var filePath = context.resourcePath;
    if (filePath.indexOf(__dirname) === 0) {
        filePath = filePath.replace(__dirname, '.');
    }

    var code = fs.readFileSync(context.resourcePath, { encoding: 'utf-8' });

    if (code.indexOf("@import") > -1) {
        importTree = true;
    }

    console.log(importTree)

    if (options.files && importTree) {
        lintFiles(processFile, filePath, content, options, context, callback);
    } else {
        delete options.files;
        lintFile(processFile, filePath, content, options, context, callback);
    }
}

function lintFile(processFile, filePath, content, options, context, callback) {
    var lintOptions = assign({}, options, {
        code: fs.readFileSync(context.resourcePath, { encoding: 'utf-8' }),
        syntax: path.extname(filePath).replace('.', ''),
        formatter: 'json'
    });
    if (processFile) {
        stylelint.lint(lintOptions)
            .then(data => {
                return data.results[0];
            })
            .then(result => processResult(result, content, options, context, callback, filePath))
            .catch(error => {
                callback(error);
            });
        callback(null, content);
    } else if (callback) {
        callback(null, content);
    }
}

function lintFiles(processFile, filePath, content, options, context, callback) {
    var lintOptions = assign({}, options, {
        syntax: path.extname(filePath).replace('.', ''),
        formatter: 'json'
    });

    if (processFile) {
        stylelint.lint(lintOptions)
            .then(data => {
                data.results.forEach(result => {
                    processResult(result, content, options, context, callback);
                });
                callback(null, content);
            })
            .catch(error => {
                callback(error);
            });
    } else if (callback) {
        callback(null, content);
    }
}

function processResult(result, content, options, context, callback, filePath) {
    if (options.displayOutput && result.warnings.length > 0) {
        var path = filePath ? filePath : result.source;
        console.log(chalk.blue.underline.bold(path));
    }
    result.warnings.forEach(warning => {
        var position = `${warning.line}:${warning.column}`;
        if (!warning.severity) {
            if (options.displayOutput) {
                console.log(chalk.cyan(`${warning.text}`));
            }
            if (options.webpackErrors) {
                context.emitError(`${warning.text}`);
            }
        }
        else if (warning.severity === 'warning') {
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
    if (options.displayOutput && result.warnings.length > 0) {
        console.log('');
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

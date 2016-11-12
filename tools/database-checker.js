/**
 * Created by fmgo on 13/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const log = require('winston');
var inquirer = require('inquirer');
const database = require('../common/database');
const moment = require('moment');
const async = require('async');
const fmgoutils = require('../common/fmgoutils');
const IGBroker = require('../brokers/IGBroker');
const config = require('../config');

const fetchQuoteFromIg = (choices, callback) => {
  inquirer.prompt([
    {
      type: 'checkbox',
      name: 'dates',
      message: 'Check the dates you want to fetch from IG?',
      choices,
    }]).then(function (answers) {
    log.info(answers.dates, answers.dates.length);
    if (answers.dates.length) {
      log.info('Log in to ig...');
      const broker = new IGBroker();
      broker.login(config.ig.identifier, config.ig.password, config.ig.apiKey, (err, result) => {
        if (err) {
          log.error('Error login to IG API', err);
          callback(err);
        } else {
          log.info(`Broker logged to IG API (${result.currentAccountId})`, { result });
          async.each(answers.dates, (opt, cb) => {
            broker.getQuotes(opt, (err, quotes) => {
              log.info(quotes);
              database.upsertQuotes(quotes, (err, quotes) => {
                cb(err);
              });
            });
          }, callback);
        }
      });
    } else {
      callback();
    }
  });
};

exports.checkMissingQuotes = (opt, cb) => {
  log.info('Check Missing Minutes (Only 1MINUTE Quote currently...)', opt);
  const epic = opt.epic;
  const utm = moment(opt.from);
  const to = moment(opt.to);
  const resolution = opt.resolution;
  let missingQuotes = [];
  const grpMissingQuote = [];
  let count = 0;
  let countMissinQuotes = 0;
  async.whilst(
    () => utm < to,
    (callback) => {
      // log.info('Check quote', utm.format());
      if (fmgoutils.isMarketOpen(utm)) {
        database.getQuoteUtm({
          epic,
          utm,
          resolution,
        }, (err, quote) => {
          // log.info(quote);
          if (err) {
            return process.nextTick(() => {
              cb(err);
            });
          }
          if (!quote) {
            // log.info(`Miss quote: ${utm.format()}`, quote);
            countMissinQuotes++;
            missingQuotes.push(utm.format());
          } else {
            if (missingQuotes.length) {
              grpMissingQuote.push(missingQuotes);
              missingQuotes = [];
            }
          }
          count++;
          utm.add(resolution.nbUnit, resolution.unit);
          process.nextTick(callback);
        });
      } else {
        if (missingQuotes.length) {
          grpMissingQuote.push(missingQuotes);
          missingQuotes = [];
        }
        // log.verbose(`market is closed ${utm.format()}`);
        utm.add(resolution.nbUnit, resolution.unit);
        process.nextTick(callback);
      }
    }, (err) => {
      if (err) {
        log.error(err);
        cb(err);
      }
      if (missingQuotes.length) {
        grpMissingQuote.push(missingQuotes);
        missingQuotes = [];
      }
      const choices = [];
      async.each(grpMissingQuote, (grp, callback) => {
        choices.push({
          key: `${choices.length}`,
          name: `${moment(grp[0]).subtract(1, 'minute').toDate()} => ${moment(grp[grp.length - 1]).add(1, 'minute').toDate()} (${grp.length})`,
          value: {
            epic,
            query: {
              resolution: 'MINUTE',
              from: moment(grp[0]).add(1, 'hour').subtract(1, 'minute').utc().toDate(),
              to: moment(grp[grp.length - 1]).add(1, 'hour').add(1, 'minute').utc().toDate(),
            },
          }
        });
        callback()
      }, (err) => {
        fetchQuoteFromIg(choices, cb);
      });
    });
};
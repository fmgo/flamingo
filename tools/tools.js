/**
 * Created by fmgo on 13/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const dbChecker = require('./database-checker');
const database = require('../common/database');
const argv = require('optimist').argv;
const log = require('winston');
const fmgoutils = require('../common/fmgoutils');
const moment = require('moment');
const async = require('async');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'verbose',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

if (argv.dbCheck) {
  const mongoDbUrl = argv.mongoDbUrl;
  const from = argv.from;
  const to = argv.to;
  const epic = argv.epic;
  const resolution = argv.resolution;
  //TODO Check opt, set from/to according to resolution...

  const opt = {
    from,
    to,
    epic,
    resolution,
  };
  log.info('Connect to mongo:', mongoDbUrl);
  database.connect(mongoDbUrl, (err, db) => {
    if (!err) {
      log.info(opt);
      dbChecker.checkMissingQuotes(opt, (err, res) => {
        process.exit(0);
      });
    } else {
      log.error(err);
    }
  });
}

if (argv.buildDb) {
  console.log('Build DB');
  const mongoDbUrl = argv.mongoDbUrl;
  const from = moment(argv.from);
  const endTime = moment(argv.to);
  const epic = argv.epic;
  const resolution = argv.resolution;

  database.connect(mongoDbUrl, (err, db) => {
    if (!err) {
      const agFrom = from.clone();
      const agTo = from.clone().add(resolution.nbUnit, resolution.unit);
      async.whilst(
        /**
         * Check if currentTime is after endTime
         */
        () => agTo <= endTime,
        (next) => {
          const opt = {
            utm: agTo,
            epic,
            resolution,
            limit: 0,
            upsert: true,
          };
          log.info(`${agFrom.format()}, ${agTo.format()}`);
          database.aggregateQuoteFromTick(opt, (errAggregate, res) => {
            if (errAggregate) {
              log.error(errAggregate);
            } else {
              log.info(res.length);
            }
            agTo.add(opt.resolution.nbUnit, opt.resolution.unit);
            next();
          });
        });
    } else {
      log.info(err);
    }
  });
}

if (argv.cleanDb) {
  const mongoDbUrl = argv.mongoDbUrl;
  const epic = argv.epic;

  const opt = {
    epic,
  };
  database.connect(mongoDbUrl, (err, db) => {
    if (!err) {
      database.clean0Value(opt, (err, res) => {
        log.info(err, res);
        process.exit(0);
      });
    }
  });
}

if (argv.isOpen) {
  const isOpen = fmgoutils.isMarketOpen(moment()) ? 'Yes' : 'No';
  log.info(`Is Market open ? ${isOpen}`);
}

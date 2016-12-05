/**
 * Created by fmgo on 28/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const argv = require('optimist').argv;
const log = require('winston');
const moment = require('moment');
const database = require('../common/database');
const dbChecker = require('./database.check');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'info',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});
log.add(log.transports.File, {
  filename: 'buildDb.log',
  level: 'error',
  json: false,
});


if (argv.checkDb) {
  const mongoDbUrl = argv.mongoDbUrl;
  const from = argv.from;
  const to = argv.to;
  const epic = argv.epic;
  const resolution = argv.resolution;

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
      dbChecker.checkMissingQuotes(opt, (errCheck, res) => {
        if (errCheck) {
          log.error(errCheck);
        }
        process.exit(0);
      });
    } else {
      log.error(err);
    }
  });
}

if (argv.buildDb) {
  const mongoDbUrl = argv.mongoDbUrl;
  const from = moment(argv.from);
  const to = moment(argv.to || '');
  const epic = argv.epic;
  const resolution = argv.resolution;
  database.connect(mongoDbUrl, (err) => {
    if (!err) {
      database.buildQuotesCollection({
        epic,
        from,
        to,
        resolution,
      }, (err) => {
        if (err) {
          log.error(err);
        }
        log.info('Finish');
      });
    } else {
      log.info(err);
    }
  });
}

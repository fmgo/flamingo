/**
 * Created by fmgo on 28/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const argv = require('optimist').argv;
const log = require('winston');
const moment = require('moment');
const async = require('async');
const database = require('../common/database');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'verbose',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

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
      });
      // const agTo = from.clone().add(resolution.nbUnit, resolution.unit);
      // async.whilst(
      //   /**
      //    * Check if currentTime is after endTime
      //    */
      //   () => agTo <= endTime,
      //   (next) => {
      //     const opt = {
      //       epic,
      //       utm: agTo,
      //       resolution,
      //       limit: 0,
      //       upsert: true,
      //     };
      //     log.info(`${agTo.format()}`);
      //     database.aggregateQuoteFromTick(opt, (errAggregate, res) => {
      //       if (errAggregate) {
      //         log.error(errAggregate);
      //       }
      //       agTo.add(opt.resolution.nbUnit, opt.resolution.unit);
      //       next();
      //     });
      //   });
    } else {
      log.info(err);
    }
  });
}

/**
 * Created by fmgo on 03/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const argv = require('optimist').argv;
const log = require('winston');
const config = require('./config');
const database = require('./common/database');
const Trader = require('./Trader');
const EPIC = argv.epic || 'CS.D.EURUSD.MINI.IP';

/**
 * Init the logger
 */
const logOpt = config.logOpt || {};
log.remove(log.transports.Console);
log.add(log.transports.Console, config.logOpt);
logOpt.filename = `${EPIC}.log` || 'default.log';
log.add(log.transports.File, logOpt);

/**
 * Connect to database
 */
database.connect(config.mongoDbUrl, (err) => {
  if (err) {
    log.error(err);
  }
  /**
   * Create the trader with the market and strategy and start trading
   */
  const STRATEGY = config.strategies[EPIC];
  const IG_CREDENTIALS = config.ig;
  const trader = new Trader(STRATEGY, IG_CREDENTIALS);
  trader.start();
});

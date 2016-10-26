/**
 * Created by fmgo on 03/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const argv = require('optimist').argv;
const async = require('async');
const log = require('winston');
const moment = require('moment');
const Trader = require('./Trader');
const database = require('./common/database');
const config = require('./config');

/**
 * Init the logger
 */
log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: config.logLevel,
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

/**
 * Set the market and strategy to trade
 * TODO - Get Market From Database into Trader (pass only epic to the trader)
 */
const market = {
  epic: 'CS.D.EURUSD.MINI.IP',
  lotSize: 1,
  contractSize: 10000,
  currencyCode: 'USD',
};

/**
 * Set the trading strategy
 */
const strategy = {
  sma: 35,
  resolution: { unit: 'minute', nbUnit: 15 },
  stopLoss: -7,
  trailingStop: -7,
  risk: 0.03,
};

/**
 * Set the backtest options
 */
const btOpt = {
  from: '2016-09-12T21:10:00.000Z',
  to: '2016-10-21T20:50:00.000Z',
  balance: 4500,
};

/**
 * Create the trader with the market and strategy
 */
const trader = new Trader(market, strategy);

log.info('Start Trading...', { market, strategy });
async.waterfall([
  /**
   * Connect the database
   */
  (next) => {
    database.connect(config.mongoDbUrl, (err) => {
      if (err) {
        log.error(err);
      }
      process.nextTick(() => {
        next(err);
      });
    });
  },
  /**
   * Build DB if needed.
   * If backtest asked build quotes with from/to from backtest options
   * If live trading asked build quotes from time needed by the strategy to now
   */
  (next) => {
    if (argv.buildDb) {
      log.info('Build Database');
      const to = moment().seconds(0).milliseconds(0);
      const from = to.clone().subtract((strategy.sma + 1) * strategy.resolution.nbUnit, strategy.resolution.unit);
      const buildDbOpt = {
        epic: market.epic,
        from,
        to,
        resolution: strategy.resolution,
      };
      if (argv.b) {
        buildDbOpt.from = moment(btOpt.from);
        buildDbOpt.to = moment(btOpt.to);
      }
      database.buildQuotesCollection(buildDbOpt, (err, res) => {
        next(err, res);
      });
    } else {
      process.nextTick(() => {
        next(null, {});
      });
    }
  },
  /**
   * Run Backtest or Live trading
   */
  (opt, next) => {
    if (argv.b || argv.backtest) {
      trader.backtest(btOpt, (err, res) => {
        if (err) {
          log.error(err);
        }
        log.info(res);
        next();
      });
    } else if (argv.l || argv.live) {
      trader.start();
    } else {
      process.nextTick(() => {
        next();
      });
    }
  },
], (err) => {
  if (err) {
    log.error(err);
  }
});

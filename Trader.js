/**
 * Created by fmgo on 03/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const log = require('winston');
const moment = require('moment');
const async = require('async');
const schedule = require('node-schedule');
const _ = require('lodash');

const config = require('./config');
const Broker = require('./brokers/Broker');
const IGBroker = require('./brokers/IGBroker');
const fmgOutils = require('./common/fmgoutils');
const database = require('./common/database');
const signals = require('./common/signals');

/**
 * @class Trader
 *
 * @property {Object} market
 * @property {Object} strategy
 */
class Trader {
  /**
   * Create the trader with a market to trade and the strategy to apply
   *
   * @param {Object} market
   * @param {Object} strategy
   */
  constructor(market, strategy) {
    log.verbose(`Create Trader for : ${market.epic}`, { market, strategy });
    this.market = market;
    this.strategy = strategy;
  }

  /**
   * Start live trading
   */
  start() {
    const self = this;
    /**
     * Init the context
     */
    const context = {
      market: self.market,
      strategy: self.strategy,
    };
    log.info(`Start live trading: ${self.market.epic}`, context);

    /**
     * Create the IG Broker and log in to IG API
     */
    const broker = new IGBroker();
    broker.login(config.ig.identifier, config.ig.password, config.ig.apiKey, (err, result) => {
      if (err) {
        log.error('Error login to IG API', err);
        process.exit(-1);
      } else {
        log.info(`Broker logged to IG API (${result.currentAccountId})`);

        /**
         * Start the cron to run analyse every minutes
         */
        self.minuteJobs = schedule.scheduleJob('* */1 * * *', () => {
          /**
           * Set the current context time (set seconds and milliseconds to 0)
           * run analyse and log report
           */
          context.utm = moment().seconds(0).milliseconds(0);
          log.verbose(`Context time: ${context.utm.format()}`);
          self.analyse(broker, context, (errAnalyse, results) => {
            if (errAnalyse) {
              log.error(errAnalyse);
            } else {
              self.logReport(results);
            }
          });
        });
      }
    });
  }

  /**
   * Start Backtest
   *
   * @param {Object} opt
   * @param {Function} done
   */
  backtest(opt, done) {
    const self = this;

    /**
     * Init Reports and Context
     */
    const endTime = moment(opt.to);
    const reports = [];
    const activities = [];
    const transactions = [];
    const context = {
      utm: moment(opt.from),
      market: self.market,
      strategy: self.strategy,
      simu: true,
    };

    /**
     * Create the broker and init the account balance
     */
    const broker = new Broker(opt.balance);
    async.whilst(
      /**
       * Check if currentTime is after endTime
       */
      () => context.utm < endTime,
      /**
       * Analyse current context log Report save activities and transactions
       * then add a minute to the context utm until the context utm is after endTime.
       */
      (callback) => {
        self.analyse(broker, context, (errAnalyse, ctxAnalysed) => {
          if (errAnalyse) {
            callback(errAnalyse);
          }
          if (ctxAnalysed.closeOrder !== null) {
            activities.push(ctxAnalysed.closeOrder);
          }
          if (ctxAnalysed.openOrder !== null) {
            activities.push(ctxAnalysed.openOrder);
          }
          if (ctxAnalysed.closedPosition) {
            transactions.push(ctxAnalysed.closedPosition);
          }
          self.logReport(ctxAnalysed, (errReport, report) => {
            reports.push(report);
            context.utm.add(1, 'minute');
            callback(errReport);
          });
        });
      },
      /**
       * Log the reports, activities and transactions and callback
       * end backtest...
       */
      (err) => {
        if (err) {
          done(err);
        } else {
          log.verbose(`Activities (${activities.length})`, activities);
          log.info(`Transactions (${transactions.length})`, transactions);
          const results = fmgOutils.calcExpectancy(transactions);
          log.info(reports[reports.length - 1]);
          done(null, results);
        }
      });
  }

  /**
   * Analyse:
   * 1 - (Broker) Update the context for the current context datetime
   * 2 - (Trader) Check stops
   * 3 - (Trader) Calculate BUY Or SELL Signal
   * 4 - (Trader) Generate orders (Entry/Exit) according to signal and position
   * 5 - (Trader) Handle Orders (Send Close then Open order to the broker)
   */
  analyse(broker, ctx, callback) {
    const self = this;
    async.waterfall([
      (next) => {
        broker.updateContext(ctx, (err, updatedContext) => {
          log.verbose(`Updated Context to analyse ${ctx.market.epic} : ${ctx.utm.format()}`);
          next(err, broker, updatedContext);
        });
      },
      self.checkStops,
      self.calcSignals,
      self.handleSignals,
      self.handleOrders,
    ], (err, context) => {
      process.nextTick(() => {
        callback(err, context);
      });
    });
  }

  /**
   * Check stops
   * if there is an open position :
   * 1 - Update profit
   * 2 - Check stopProfit is below current profit
   * 2a - If position stopped send the close order to the broker
   * 2b - TODO Else update stopPrice if needed
   * 3 - Update the context
   *
   * @param broker
   * @param ctxToCheck
   * @param callback
   */
  checkStops(broker, ctxToCheck, callback) {
    log.verbose(`Check stops ${ctxToCheck.market.epic} : ${ctxToCheck.utm.format()}`);
    if (!ctxToCheck.position) {
      log.verbose(`No Position to check ${ctxToCheck.utm.format()}`);
      process.nextTick(() => {
        callback(null, broker, ctxToCheck);
      });
    } else {
      async.waterfall([
        (next) => {
          const context = ctxToCheck;
          const basePrice = 1 / context.position.currentPrice;
          context.position = fmgOutils.calcPositionProfit(context.position, basePrice);
          database.getMinMaxPricePosition(context.position, (err, result) => {
            if (err || !result) {
              return next(err || 'Error getting min max prices for position');
            }
            context.position.minPrice = result.minPrice;
            context.position.maxPrice = result.maxPrice;
            return next(err, context);
          });
        },
        (ctx, next) => {
          const context = ctx;
          const epic = context.market.epic;
          const resolution = context.strategy.resolution;
          const nbPoints = context.strategy.atr;
          const ratio = context.strategy.atrRatio;

          database.getQuotes({
            epic,
            resolution,
            nbPoints: nbPoints * 2,
            utm: context.utm.clone(),
          }, (err, quotes) => {
            if (err) {
              log.error(err);
              callback(err);
            }
            quotes.reverse();
            signals.getStopPrice(quotes, context.position, nbPoints, ratio, (errStopPrice, stopPrice) => {
              if (errStopPrice || !stopPrice) {
                log.error(errStopPrice);
                next(errStopPrice);
              }
              context.position.stopPrice = stopPrice;
              next(errStopPrice, context);
            });
          });
        },
        (ctx, next) => {
          const context = ctx;
          const isStopped = fmgOutils.isPositionStopped(context.position);
          if (isStopped) {
            log.verbose('Stop position', context);
            broker.closePosition(context.position, (err, closedPosition) => {
              if (err) {
                log.error('Error closing position', err);
                callback(err);
              }
              context.closedPosition = closedPosition;
              context.position = null;
              log.verbose(`Position stopped ${context.closedPosition.currentProfit}`, context.closedPosition);
              callback(err, broker, context);
            });
          } else {
            next(null, broker, context);
          }
        },
      ], callback);
    }
  }

  /**
   * Calc BUY/SELL Signals
   * Get Quotes needed to calc the indicators
   * and generate a BUY or SELL Signal
   *
   * @param broker
   * @param ctx
   * @param callback
   */
  calcSignals(broker, ctx, callback) {
    const context = ctx;
    context.smaCrossPrice = null;
    /**
     * If there is a new quote we check
     * if it cross the Sma
     */
    if (context.quote) {
      log.verbose(`Calc Signals ${context.market.epic} ${context.utm.format()}`);
      const epic = context.market.epic;
      const resolution = context.strategy.resolution;
      const nbPoints = context.strategy.sma + 1;
      /**
       * Get quotes needed to calc the SMA
       */
      database.getQuotes({
        epic,
        resolution,
        nbPoints,
        utm: context.utm.clone(),
      }, (err, quotes) => {
        if (err) {
          log.error(err);
          callback(err);
        }
        quotes.reverse();
        const prices = _.map(quotes, (quote) => quote.bidClose + ((quote.askClose - quote.bidClose) / 2));
        log.verbose('Check if price cross SMA', prices);
        /**
         * Check if the price cross the SMA, if it cross down set the signal to SELL
         * if it cross up set the signal to BUY, else set the signal to null
         */
        signals.smaCrossPrice(prices, context.strategy.sma, (errSmaCrossPrice, res) => {
          if (errSmaCrossPrice) {
            log.error(errSmaCrossPrice);
            callback(errSmaCrossPrice);
          }
          if (res.signal) {
            log.verbose(`Signal for ${context.market.epic} at ${context.utm.format()}: ${res.signal}`, res);
            context.smaCrossPrice = res.signal;
          }
          callback(null, broker, context);
        });
      });
    } else {
      process.nextTick(() => {
        callback(null, broker, ctx);
      });
    }
  }

  /**
   * Handle the signals
   * If there is an open position against the signal create a closeOrder
   * If there is a signal create a openOrder
   * if there is no signal set openOrder and closeOrder to null
   *
   * @param broker
   * @param ctx
   * @param callback
   */
  handleSignals(broker, ctx, callback) {
    const context = ctx;
    /**
     * Reset the orders
     */
    context.openOrder = null;
    context.closeOrder = null;
    if (context.smaCrossPrice) {
      log.verbose(`Handle Signals ${context.smaCrossPrice}`);
      if (context.position && context.position.direction !== context.smaCrossPrice) {
        context.closeOrder = context.position;
        log.verbose('New close order', context.closeOrder);
      }
      if (!context.position || context.closeOrder) {
        /**
         * Calc the position size according to
         * the context strategy and the current price
         */
        const epic = context.market.epic;
        const resolution = context.strategy.resolution;
        const nbPoints = context.strategy.atr;
        const ratio = context.strategy.atrRatio;

        database.getQuotes({
          epic,
          resolution,
          nbPoints: nbPoints * 2,
          utm: context.utm.clone(),
        }, (err, quotes) => {
          if (err) {
            log.error(err);
            callback(err);
          }
          quotes.reverse();
          signals.getStopPips(quotes, nbPoints, ratio, (errStopPrice, stopPips) => {
            if (errStopPrice || !stopPips) {
              log.error(errStopPrice);
              callback(errStopPrice);
            }
            const size = fmgOutils.calcPositionSize(
              context.account.balance,
              context.ask || context.bid,
              context.strategy.risk,
              stopPips * 10000,
              context.market.lotSize
            );

            /**
             * Create the open order
             */
            context.openOrder = {
              utm: context.utm.toDate(),
              direction: context.smaCrossPrice === 'XUP' ? 'BUY' : 'SELL',
              epic: context.market.epic,
              market: context.market,
              bid: context.bid,
              ask: context.ask,
              size,
              currencyCode: context.market.currencyCode,
            };
            log.debug('New open order', context.openOrder);
            callback(null, broker, context);
          });
        });
      } else {
        process.nextTick(() => {
          callback(null, broker, context);
        });
      }
    } else {
      process.nextTick(() => {
        callback(null, broker, context);
      });
    }
  }

  /**
   * Handle Orders
   * Close the position if there is a closeOrder THEN
   * open a new position with the openOrder
   *
   * @param broker
   * @param ctx
   * @param callback
   */
  handleOrders(broker, contextToHandle, callback) {
    async.waterfall([
      (next) => {
        const context = contextToHandle;
        if (context.closeOrder) {
          log.verbose(`Close Position ${context.market.epic} ${context.utm.format()}`, context.closeOrder);
          broker.closePosition(context.closeOrder, (err, closedPosition) => {
            if (err) {
              log.error(err);
              next(err);
            }
            context.closedPosition = closedPosition;
            context.position = null;
            next(err, context);
          });
        } else {
          next(null, context);
        }
      },
      (ctx, next) => {
        const context = ctx;
        if (context.openOrder) {
          log.verbose(`Open Position ${context.market.epic} ${context.utm.format()}`, context.openOrder);
          broker.openPosition(context.openOrder, (err, openPosition) => {
            if (err) {
              log.error(err);
              next(err);
            }
            context.position = openPosition;
            next(err, context);
          });
        } else {
          process.nextTick(() => {
            next(null, context);
          });
        }
      }], callback);
  }

  /**
   * Generate and log the report from the context analysed
   *
   * @param context
   * @param callback
   */
  logReport(context, callback) {
    let position = context.position;
    if (position) {
      position = {
        direction: context.position.direction,
        size: context.position.size,
        currentProfit: context.position.currentProfit,
      };
    }
    const report = {
      epic: context.market.epic,
      utm: context.utm.toDate(),
      bid: context.bid,
      ask: context.ask,
      price: context.price,
      balance: context.account.balance,
      position,
      smaCrossPrice: context.smaCrossPrice,
    };
    log.verbose('Result Analyse:', report);
    log.info(`${report.utm} : ${report.balance.toFixed(0)} (${position ? position.currentProfit : '-'})`);
    if (callback) {
      process.nextTick(() => {
        callback(null, report);
      });
    }
  }
}

/**
 * Export Class
 */
module.exports = Trader;

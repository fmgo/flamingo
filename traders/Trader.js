/**
 * Created by fmgo on 03/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const async = require('async');
const log = require('winston');
const moment = require('moment');
const schedule = require('node-schedule');

const database = require('../common/database');
const fmgOutils = require('../common/fmgoutils');
const signals = require('../common/signals');
const IGBroker = require('../brokers/IGBroker');

/**
 * @class Trader
 *
 * @property {Object} epic
 * @property {Object} strategy
 *
 */
class Trader {
  /**
   * Create the trader with a market to trade and the strategy to apply
   *
   * @param {Object} strategy
   * @param {Object} igCredentials
   */
  constructor(strategy, igCredentials) {
    log.info('Create Trader', { strategy, igIdentifier: igCredentials.identifier });
    this.epic = strategy.epic;
    this.strategy = strategy;
    this.igCredentials = igCredentials;
  }

  /**
   * Start live trading
   */
  start() {
    const broker = new IGBroker();
    async.waterfall([
      (next) => {
        broker.login(this.igCredentials, (err, accountId) => {
          if (err) {
            next(err);
          } else {
            log.info('Broker logged to IG API', accountId);
            next();
          }
        });
      }, (next) => {
        broker.getMarket(this.epic, (errMarket, market) => {
          if (errMarket) {
            next(errMarket);
          } else {
            database.updateMarket(market);
            next(errMarket, market);
          }
        });
      }, (next) => {
        const context = {
          epic: this.epic,
          strategy: this.strategy,
        };
        schedule.scheduleJob('5 * * * * *', () => {
          log.info('Analyse context', context);
          context.utm = moment().seconds(0).milliseconds(0);
          this.analyse(broker, context, (errAnalyse, results) => {
            if (errAnalyse) {
              log.error(errAnalyse);
              next(errAnalyse);
            } else {
              fmgOutils.getReport(results, (errReport, report) => {
                log.info(report);
              });
            }
          });
        });
      },
    ], (err) => {
      if (err) {
        log.error(err);
        process.exit(-1);
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
        broker.updateContext(ctx, (err, context) => {
          next(err, broker, context);
        });
      },
      self.checkStops,
      self.calcSignals,
      self.calcTrend,
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
   * 1 - Update profitPip
   * 2 - Check Target and Stop distance
   * 2a - If position stopped send the close order to the broker
   * 3 - Update the context
   *
   * @param ctx
   * @param callback
   *
   */
  checkStops(broker, ctx, callback) {
    const context = ctx;
    log.info('Check stops', context.epic);
    if (context.position) {
      context.position.currentProfit = fmgOutils.getPipProfit(context.position);
      if (fmgOutils.isPositionStopped(context)) {
        broker.closePosition(context.closeOrder, (err, closedPosition) => {
          if (err) {
            log.error(err);
            callback(err);
          }
          context.closedPosition = closedPosition;
          context.position = null;
          callback(err, broker, context);
        });
      }
    } else {
      process.nextTick(() => {
        callback(null, broker, context);
      });
    }
  }

  /**
   * Calc BUY/SELL Signals
   * Get Quotes needed to calc the indicators
   * and generate a BUY or SELL Signal
   *
   * @param ctx
   * @param callback
   */
  calcSignals(broker, ctx, callback) {
    const context = ctx;
    context.smaCrossPrice = null;
    log.info('Calc signals', context.epic);

    /**
     * If there is a new quote we check
     * if it cross the Sma
     */
    if (context.quote
      && context.utm.get('hour') < context.strategy.tradingHours.stop
      && context.utm.get('hour') >= context.strategy.tradingHours.start
    ) {
      const epic = context.market.epic;
      const resolution = context.strategy.resolution;
      const nbPoints = context.strategy.sma + 1;
      /**
       * Get prices to calc the SMA
       */
      database.getPrices({
        epic,
        resolution,
        nbPoints,
        utm: context.utm.clone(),
      }, (err, prices) => {
        if (err) {
          log.error(err);
          callback(err);
        }
        /**
         * Check if the price cross the SMA, if it cross down set the signal to SELL
         * if it cross up set the signal to BUY, else set the signal to null
         */
        signals.smaCrossPrice(prices, context.strategy.sma, (errSma, res) => {
          if (errSma) {
            log.error(errSma);
            callback(errSma);
          }
          context.smaValue = res.meta.currentSma;
          context.smaCrossPrice = res.signal;
          callback(null, broker, context);
        });
      });
    } else {
      process.nextTick(() => {
        callback(null, broker, context);
      });
    }
  }

  /**
   * Calc Trend
   * Get Quotes needed to calc the indicators
   * Check the current Trend
   *
   * @param ctx
   * @param callback
   */
  calcTrend(broker, ctx, callback) {
    log.info('Calc trend', ctx.epic);
    const context = ctx;
    context.trend = null;
    /**
     * If there is a new quote we check
     * if it is Below or above the current trend SMA
     */
    if (context.quote && context.smaCrossPrice && context.strategy.smaTrend) {
      const epic = context.market.epic;
      const resolution = context.strategy.resolution;
      const nbPoints = context.strategy.smaTrend;
      /**
       * Get quotes needed to calc the SMA
       */
      database.getPrices({
        epic,
        resolution,
        nbPoints,
        utm: context.utm.clone(),
      }, (err, prices) => {
        if (err) {
          log.error(err);
          callback(err);
        }
        /**
         * Check if price is above or below the sma trend
         */
        signals.calcTrend(prices, nbPoints, (errTrend, res) => {
          if (errTrend) {
            log.error(errTrend);
            callback(errTrend);
          }
          context.trendValue = res.meta.currentSma;
          context.trend = res.trend;
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
   * @param ctx
   * @param callback
   */
  handleSignals(broker, ctx, callback) {
    log.info('Handle Signals', ctx.epic);
    const context = ctx;
    /**
     * Reset the orders
     */
    context.openOrder = null;
    context.closeOrder = null;
    if (context.smaCrossPrice
      && ((context.trend && context.trend.includes(context.smaCrossPrice)) || !context.strategy.smaTrend)
    ) {
      if (context.position && context.position.direction !== context.smaCrossPrice) {
        context.closeOrder = context.position;
      }
      if (!context.position || context.closeOrder) {
        /**
         * Calc the position size according to
         * the context strategy and the current price
         */
        const stopDistance = context.stopDistance;
        const limitDistance = context.limitDistance;
        const size = fmgOutils.calcPositionSize(
          context.account.balance,
          context.price,
          context.strategy.riskPerTrade,
          stopDistance,
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
          stopDistance,
          limitDistance,
          currencyCode: context.market.currencies[0].code,
        };
        callback(null, broker, context);
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
   * @param contextToHandle
   * @param callback
   */
  handleOrders(broker, contextToHandle, callback) {
    log.info('Handle Orders', contextToHandle.epic);
    async.waterfall([
      (next) => {
        const context = contextToHandle;
        if (context.closeOrder) {
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
}

/**
 * Export Class
 */
module.exports = Trader;

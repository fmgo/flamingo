/**
 * Created by fmgo on 04/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 *
 * TODO - Describe Context in JSDoc
 * TODO - Describe Open Order in JSDoc
 * TODO - Describe Close Order in JSDoc
 *
 */
const log = require('winston');
const async = require('async');
const moment = require('moment');
const database = require('../common/database');

/**
 * @class Broker
 *
 * @property {Object} account
 * @property {Number} account.balance
 * @property {Number} account.pnl
 * @property {Object} position
 */
class Broker {
  /**
   * Broker constructor
   *
   * @param {Number} balance
   */
  constructor(balance = 10000) {
    log.verbose('Create Broker');
    this.account = {
      balance,
      pnl: 0,
    };
    this.dailyAnalyse = {
      targetProfit: 36,
      stopLoss: 12,
    };
    this.position = null;
  }

  /**
   * Update the context with the current utm
   *
   * @param {Context} context
   * @param callback
   */
  updateContext(context, callback) {
    log.verbose('Update Context %s', context.utm.format());
    async.waterfall([
      /**
       * Update DailyAnalyse if needed
       * @param next
       */
      (next) => {
        const newContext = context;
        this.getMarket(newContext, (errMarket, market) => {
          newContext.market = market;
          newContext.targetProfit = this.dailyAnalyse.targetProfit;
          newContext.stopDistance = this.dailyAnalyse.stopLoss;
          next(null, newContext);
        });
        // Check if last dayliAnalysis day is different from current utm...
          // Upsert New Daily Quote...
          // Get Daily quotes for ATR
          // Calc ATR
          // Calc daily TargetProfit/StopLoss...
          // Update Daily Analysis

      },
      /**
       * Update last quote if it's time to analyse (Resolution)
       * otherwise set the current quote as null to disable analyse.
       * If Live trading is enabled upsert the current quote for indicators calculations
       */
      (ctx, next) => {
        log.verbose('Check if new quote available %s', context.utm.format());
        const newContext = ctx;
        newContext.quote = null;
        newContext.closedPosition = null;
        // Check if it's time to analyse according to the strategy resolution
        const resolution = newContext.strategy.resolution;
        if (newContext.utm.get(resolution.unit) % resolution.nbUnit === 0) {
          newContext.quote = true;
        }
        // Get last quote from tick collection if Live trading
        if (!newContext.simu && newContext.quote) {
          const opt = {
            epic: newContext.market.epic,
            utm: newContext.utm,
            resolution,
            upsert: true,
          };
          database.aggregateQuoteFromTick(opt, (err, quote) => {
            if (err || !quote) {
              return next(err || 'Error aggregating quote from tick, no quote returned');
            }
            log.verbose('New quote created', quote);
            newContext.quote = quote;
            return next(err, newContext);
          });
        } else {
          process.nextTick(() => next(null, newContext));
        }
      },
      /**
       * Update prices (Bid, Ask, Price)
       * To Calc position profit and check stops
       */
      (ctx, next) => {
        log.verbose('Update context prices %s', context.utm.format());
        const newContext = ctx;
        const epic = newContext.market.epic;
        const utm = newContext.utm;
        this.getPrice({ epic, utm }, (err, prices, minQuote) => {
          if (err || !prices.bid || !prices.ask) {
            console.log(prices);
            process.exit(-1);
            return next(err || `Error getting prices for ${utm.format()}`);
          }
          newContext.minQuote = minQuote;
          newContext.bid = prices.bid;
          newContext.ask = prices.ask;
          newContext.price = newContext.bid + ((newContext.ask - newContext.bid) / 2);
          return next(err, newContext);
        });
      },
      /**
       * Update current position, and calc profit
       */
      (ctx, next) => {
        log.verbose('Update context position if any', context.utm.format());
        const newContext = ctx;
        const epic = newContext.market.epic;
        const utm = newContext.utm;
        const tick = { bid: ctx.bid, ask: ctx.ask };
        this.getPosition({ epic, utm, tick }, (err, pos) => {
          if (err) {
            return next(err);
          }
          newContext.position = pos;
          if (newContext.position) {
            newContext.position.targetProfit = this.dailyAnalyse.targetProfit;
          }
          return next(err, newContext);
        });
      },
      /**
       * Update account context
       */
      (ctx, next) => {
        log.verbose('Update context account', context.utm.format());
        const newContext = ctx;
        this.getAccount({}, (err, account) => {
          if (err) {
            return next(err);
          }
          newContext.account = account;
          return next(err, ctx);
        });
      }], callback);
  }

  /**
   * Get latest known price (Bid/Ask) at the time passed in opt
   *
   * @param {Object} opt
   * @param {String} opt.epic
   * @param {Date} opt.utm
   * @param callback
   */
  getPrice(opt, callback) {
    log.verbose('Get price', opt.utm.format());
    const epic = opt.epic;
    const utm = opt.utm;
    const prices = {};

    const resolution = { unit: 'minute', nbUnit: 1 };
    database.getQuote({ epic, utm, resolution }, (errQuote, quote) => {
      delete quote._id;
      if (errQuote || !quote) {
        callback(errQuote || `No Quote found for ${utm.format()}`);
      } else if (moment(quote.utm) === utm) {
        prices.bid = quote.bidOpen;
        prices.ask = quote.askOpen;
      } else {
        prices.bid = quote.bidClose;
        prices.ask = quote.askClose;
      }
      database.getTick({ epic, utm }, (err, tick) => {
        if (err) {
          callback(err);
        } else if (moment(tick.utm) === utm
          && tick.bid && tick.bid.length > 0
          && tick.ask && tick.ask.length > 0) {
          prices.bid = tick.bid[1] || tick.bid[0];
          prices.ask = tick.ask[1] || tick.ask[0];
        }
        callback(err, prices, quote);
      });
    });
  };

  /**
   * Get Current open Position
   *
   * @param {Object} opt
   * @param {Date} opt.utm
   * @param {Object} [opt.tick]
   * @param {Number} [opt.tick.bid]
   * @param {Number} [opt.tick.ask]
   * @param {string} [opt.epic]
   * @param callback
   */
  getPosition(opt, callback) {
    log.verbose('Get position');
    if (this.position) {
      this.position.currentDate = opt.utm.toDate();
      this.position.currentPrice = this.position.direction === 'BUY' ?
        opt.tick.bid :
        opt.tick.ask;
    }
    process.nextTick(() => callback(null, this.position));
  }

  /**
   * Open Position
   *
   * @param {OpenOrder} order
   * @param callback
   */
  openPosition(order, callback) {
    log.verbose('Open position');
    const openPrice = order.direction === 'BUY' ?
      order.ask :
      order.bid;
    const currentPrice = order.direction === 'BUY' ?
      order.bid :
      order.ask;
    this.position = {
      dealId: order.name,
      epic: order.market.epic,
      direction: order.direction,
      openDate: order.utm,
      openPrice,
      size: order.size,
      stopPrice: order.stopPrice,
      currentDate: order.utm,
      currentPrice,
      lotSize: order.market.lotSize,
      contractSize: order.market.contractSize,
      currency: order.currencyCode,
    };
    process.nextTick(() => callback(null, this.position));
  }

  /**
   * Close Position
   *
   * @param {CloseOrder} order
   * @param callback
   */
  closePosition(order, callback) {
    log.verbose('Close position');
    const closedPosition = this.position;
    this.account.balance += this.position.profitEuro;
    this.position = null;
    process.nextTick(() => callback(null, closedPosition));
  }

  getMarket(epic, callback) {
    log.verbose('Get Market');
    database.getMarket(epic, (err, market) => {
      callback(err, market);
    });
  }

  /**
   * Get Current Account
   *
   * @param {Object} opt
   * @param {Function} callback
   * @param {Object} callback.error Error if any
   * @param {Object} callback.account The Account
   */
  getAccount(opt, callback) {
    log.verbose('Get account');
    process.nextTick(() => callback(null, this.account));
  }
}

module.exports = Broker;

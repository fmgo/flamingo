/**
 * Created by fmgo on 04/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 *
 * TODO - Describe Open Order
 */
const _ = require('lodash');
const request = require('request');
const async = require('async');
const moment = require('moment');
const log = require('winston');

const Broker = require('./Broker');

/**
 * @class IGBroker
 *
 * @property {String} urlRoot
 * @property {String} identifier
 * @property {String} password
 * @property {String} apiKey
 * @property {String} accountToken
 * @property {String} clientToken
 * @property {String} accountId
 */
class IGBroker extends Broker {
  constructor() {
    super();
    log.verbose('create IGBroker');
    this.urlRoot = 'https://demo-api.ig.com/gateway/deal';
    this.identifier = null;
    this.password = null;
    this.apiKey = null;
    this.accountToken = null;
    this.clientToken = null;
    this.accountId = null;
  }

  /**
   * @typedef {Object} IGHeader
   * @property {string} X-IG-API-KEY The API key
   * @property {string} X-SECURITY-TOKEN The account token
   * @property {string} CST The client token
   * @property {string} Content-Type=application/json;charset=UTF-8
   * @property {string} Accept=application/json;charset=UTF-8
   * @property {number} [Version] The Version
   * @property {string} [_method=DELETE] only used for DELETE requests.
   */
  /**
   * @typedef {Object} IGHeaders
   * @property {IGHeader} v1 Header for API v1
   * @property {IGHeader} v2 Header for API v2
   * @property {IGHeader} v3 Header for API v3
   * @property {IGHeader} del Header for API delete methods
   */
  /**
   * {@link IGHeaders} with the tokens for the currently logged account
   *
   * @returns {IGHeaders} headers
   */
  get headers() {
    return {
      v1: {
        'X-IG-API-KEY': this.apiKey,
        'X-SECURITY-TOKEN': this.accountToken,
        CST: this.clientToken,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json; charset=UTF-8',
      },
      v2: {
        'X-IG-API-KEY': this.apiKey,
        'X-SECURITY-TOKEN': this.accountToken,
        CST: this.clientToken,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json; charset=UTF-8',
        Version: 2,
      },
      v3: {
        'X-IG-API-KEY': this.apiKey,
        'X-SECURITY-TOKEN': this.accountToken,
        CST: this.clientToken,
        'Content-Type': 'application/json; charset=UTF-8',
        Accept: 'application/json; charset=UTF-8',
        Version: 3,
      },
      del: {
        v1: {
          'X-IG-API-KEY': this.apiKey,
          'X-SECURITY-TOKEN': this.accountToken,
          CST: this.clientToken,
          'Content-Type': 'application/json; charset=UTF-8',
          Accept: 'application/json; charset=UTF-8',
          _method: 'DELETE',
        },
      },
    };
  }

  /**
   * Log in to IG API
   * @param {string} identifier
   * @param {string} password
   * @param {string} apiKey
   * @param callback
   */
  login(identifier, password, apiKey, callback) {
    log.verbose('%s log in to IG', identifier);
    this.apiKey = apiKey;
    request.post(
      `${this.urlRoot}/session`,
      {
        headers: {
          'X-IG-API-KEY': apiKey,
          Version: '2',
        },
        json: {
          identifier,
          password,
          encryptedPassword: null,
        },
      },
      (error, response, body) => {
        if (response) {
          this.accountToken = response.headers['x-security-token'];
          this.clientToken = response.headers.cst;
          this.accountId = body.currentAccountId;
          log.verbose('Loged in to IG %s', this.accountId);
          this.isLogged = true;
        }
        callback(error, body || { errorCode: error.message });
      });
  }

  /**
   * Get Position from IG API
   *
   * @param {Object} opt
   * @param {Date} opt.utm
   * @param {Object} [opt.tick]
   * @param {Number} [opt.tick.bid]
   * @param {Number} [opt.tick.ask]
   * @param {String} [opt.epic]
   * @param callback
   */
  getPosition(opt, callback) {
    log.verbose('Get Position');
    const epic = opt.epic;
    const utm = opt.utm;
    request.get(`${this.urlRoot}/positions`,
      {
        headers: this.headers.v2,
        json: true,
      }, (error, response, body) => {
        let position = null;
        if (response) {
          const positions = body.positions;
          const igPos = _.find(positions, (o) => o.market.epic === epic);
          if (igPos) {
            position = {
              dealId: igPos.position.dealId,
              dealReference: igPos.position.dealReference,
              epic: igPos.market.epic,
              direction: igPos.position.direction,
              openDate: igPos.position.createdDateUTC,
              openPrice: igPos.position.level,
              size: igPos.position.size,
              stopPrice: igPos.position.stopPrice,
              currentDate: utm.toDate(),
              currentPrice: igPos.market.offer,
              lotSize: igPos.market.lotSize,
              contractSize: igPos.position.contractSize,
              currency: igPos.position.currency,
            };
          }
        }
        callback(error, position);
      });
  }

  /**
   * Get the current account balance from IG REST API
   *
   * @param {Object} opt
   * @param {Function} callback
   * @param {Object} callback.error Error if any
   * @param {Object} callback.account The Account
   * *See IG REST documentation: {@link https://labs.ig.com/rest-trading-api-reference/service-detail?id=397 /session}
   */
  getAccount(opt, callback) {
    log.verbose('Get Account');
    request.get(`${this.urlRoot}/accounts`,
      {
        headers: this.headers.v1,
        json: true,
      }, (error, response, body) => {
        if (error) {
          log.error(error);
          callback(error);
        }
        const account = {
          balance: body.accounts[0].balance.balance,
          pnl: body.accounts[0].balance.profitLoss,
          currency: body.accounts[0].currency,
        };
        callback(error, account);
      });
  }

  /**
   * Send Open Order to IG Broker
   * @param {OpenOrder} order
   * @param callback
   */
  openPosition(order, callback) {
    log.verbose('Open Position');
    const igOrder = {
      epic: order.epic,
      expiry: '-',
      direction: order.direction,
      size: order.size,
      orderType: 'MARKET',
      guaranteedStop: false,
      trailingStop: false,
      forceOpen: true,
      currencyCode: order.currencyCode,
    };
    if (order.limitDistance) {
      igOrder.limitDistance = order.limitDistance;
    } if (order.stopDistance) {
      igOrder.stopDistance = order.stopDistance;
    }
    request.post(
      `${this.urlRoot}/positions/otc`,
      {
        headers: this.headers.v2,
        json: igOrder,
      },
      (error, response, body) => {
        callback(error, body);
      });
  }

  /**
   * Send close order to IG Broker
   * @param position
   * @param callback
   */
  closePosition(position, callback) {
    log.verbose('Close Position');
    const igOrder = {
      dealId: position.dealId,
      epic: null,
      expiry: null,
      direction: position.direction === 'BUY' ? 'SELL' : 'BUY',
      size: Number(position.size),
      level: null,
      orderType: 'MARKET',
      timeInForce: null,
      quoteId: null,
    };
    request.post(
      `${this.urlRoot}/positions/otc`,
      {
        headers: this.headers.del.v1,
        json: igOrder,
      },
      (error, response, body) => {
        callback(error, body);
      });
  }

  /**
   * Callback for getPrices.
   *
   * @callback getPricesCallback
   * @param {String} [error=null] - Error first.
   * @param {Array} quotes
   */
  /**
   * Get Prices from IG REST API
   *
   * @param {Object} opt Options
   * @param {getPricesCallback} callback
   */
  getQuotes(opt, callback) {
    log.verbose('Get Quotes');
    const query = opt.query;
    query.pageSize = 0;
    const quotes = [];
    request.get(`${this.urlRoot}/prices/${opt.epic}`,
      {
        headers: this.headers.v3,
        json: true,
        qs: query || {},
      }, (error, response, body) => {
        if (error) {
          callback(error, null);
        }
        async.each(body.prices, (item, cb) => {
          const Quote = {
            epic: opt.epic,
            resolution: '1MINUTE',
            utm: moment(item.snapshotTime, 'YYYY/MM/DD HH:mm:SS').utc().toDate(),
            askOpen: item.openPrice.ask,
            askHigh: item.highPrice.ask,
            askLow: item.lowPrice.ask,
            askClose: item.closePrice.ask,
            bidOpen: item.openPrice.bid,
            bidHigh: item.highPrice.bid,
            bidLow: item.lowPrice.bid,
            bidClose: item.closePrice.bid,
            tickCount: item.lastTradedVolume,
          };
          quotes.push(Quote);
          cb();
        }, (err) => {
          callback(err, quotes);
        });
      });
  }

  /**
   * Callback for getMarket.
   *
   * @callback getMarketCallback
   * @param {String} [error=null] - Error first.
   * @param {Object} market
   */
  /**
   * Get Market with dealId from IG REST API
   *
   * @param {Object} opt Options
   * @param {getMarketCallback} callback
   */
  getMarket(opt, callback) {
    log.info('Get IG Market');
    request.get(`${this.urlRoot}/markets/${opt.epic}`,
      {
        headers: this.headers.v3,
        json: true,
      }, (error, response, body) => {
        log.info('Market', body);
        const market = {
          epic: body.instrument.epic,
          name: body.instrument.name,
          lotSize: body.instrument.lotSize,
          marketId: body.instrument.marketId,
          currencies: body.instrument.currencies,
          contractSize: Number(body.instrument.contractSize),
          valueOfOnePip: Number(body.instrument.valueOfOnePip),
          minDealSize: body.dealingRules.minDealSize,
        };
        callback(error, market);
      });
  }
}

module.exports = IGBroker;

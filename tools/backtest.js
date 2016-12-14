/**
 * Created by fmgo on 13/12/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

/**
 * Imports
 */
const async = require('async');
const mongodb = require('mongodb');
const moment = require('moment');
const log = require('winston');
const _ = require('lodash');
const talib = require('talib');

/**
 * Logger Configuration
 */
log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'info',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

/**
 * DB Url
 */
const DB_URL = 'mongodb://localhost:27017/fmgo-backtest';

/**
 * Get price from a quote
 * Calculated from value between Bid And Ask Close
 * @param quote
 */
const getPriceFromQuote = (quote) => parseFloat((quote.bidClose + ((quote.askClose - quote.bidClose) / 2)).toFixed(5));

/**
 * Check if the price cross Up or Down the SMA
 *
 * @param quotes List of quotes
 * @param sma List of sma value
 * @param key Index of the quote to check
 * @returns null if no cross, XUP if cross up, XDOWN if cross down
 */
const checkCross = (quotes, sma, key) => {
  const prevPrice = getPriceFromQuote(quotes[key - 1]);
  const currentPrice = getPriceFromQuote(quotes[key]);
  const prevSma = parseFloat(sma[key - 1].toFixed(5));
  const currentSma = parseFloat(sma[key].toFixed(5));
  let cross = null;
  if (prevPrice && prevSma && currentPrice && currentSma) {
    if (prevPrice <= prevSma && currentPrice > currentSma) {
      cross = 'XUP';
    } else if (prevPrice >= prevSma && currentPrice < currentSma) {
      cross = 'XDOWN';
    }
  }
  return cross;
};


/**
 * Calc Pips profit between current price and enter price of a position
 *
 * @param cross current position direction
 * @param currentPrice current price of the position
 * @param enterPrice enter price of the position
 * @param lotSize Lot size to calc pip from prices
 * @returns {number} pip profit
 */
const calcPipsProfit = (cross, currentPrice, enterPrice, lotSize) => {
  let currentPipProfit = parseFloat(((currentPrice - enterPrice) * lotSize).toFixed(1));
  currentPipProfit = cross === 'XUP' ? currentPipProfit : -1 * currentPipProfit;
  return currentPipProfit;
};

/**
 * Update Max Profit/Loss and current profit of a position
 * @param position the position to update
 * @param lotSize lot size to calc pip from prices
 * @returns {position} Updated position
 */
const updateProfits = (position, lotSize) => {
  const updatedPos = position;
  const highProfit = calcPipsProfit(position.cross, updatedPos.high, updatedPos.enterPrice, lotSize);
  const lowProfit = calcPipsProfit(position.cross, updatedPos.low, updatedPos.enterPrice, lotSize);
  updatedPos.profit = calcPipsProfit(position.cross, updatedPos.price, updatedPos.enterPrice, lotSize);
  updatedPos.win = position.cross === 'XUP' ? highProfit : lowProfit;
  updatedPos.loss = position.cross === 'XUP' ? lowProfit : highProfit;
  return updatedPos;
};

/**
 *  Update prices and profits of a position
 * @param position the position to update
 * @param quote the quote for updating the position
 * @param lotSize lot size to calc pip from prices
 * @returns {position}
 */
const updatePrices = (position, quote, lotSize) => {
  const updatedPos = position;
  const currentHigh = position.cross === 'XUP' ? quote.bidHigh : quote.askHigh;
  const currentLow = position.cross === 'XUP' ? quote.bidLow : quote.askLow;
  updatedPos.price = updatedPos.cross === 'XUP' ? quote.bidClose : quote.askClose;
  updatedPos.high = Math.max(position.high, currentHigh);
  updatedPos.low = Math.min(position.low, currentLow);
  return updateProfits(updatedPos, lotSize);
};

/**
 * Check if the position has been stopped from Stop loss, target profit
 *
 * @param position the position to check
 * @param strategy the strategy for stopLoss and targetProfit
 * @returns position the position uppdated
 */
const checkStops = (position, strategy) => {
  const stoppedPos = position;
  if (position.loss <= strategy.stopLoss) {
    stoppedPos.isStopped = true;
    stoppedPos.isClosed = true;
    stoppedPos.exitProfit = strategy.stopLoss;
  } else if (position.win >= position.targetProfit) {
    stoppedPos.isStopped = true;
    stoppedPos.isClosed = true;
    stoppedPos.exitProfit = strategy.targetProfit;
  }
  return stoppedPos;
};

/**
 * Close position
 * @param position position to closed
 * @param cross position to closed
 * @param quote next quote for closing price (open)
 * @param lotSize
 * @returns position closed position
 */
const closePosition = (position, cross, quote, lotSize) => {
  const closedPos = position;
  if (!closedPos.isStopped && cross && closedPos.direction !== cross) {
    closedPos.exitUtm = quote.utm;
    const closePrice = closedPos.direction === 'XUP' ? quote.bidOpen : quote.askOpen;
    closedPos.profit = calcPipsProfit(closedPos.cross, closePrice, closedPos.enterPrice, lotSize);
    closedPos.isClosed = true;
  }
  return closedPos;
};

/**
 * Check if current utm is in the trading hours
 * @param strategy
 * @param utm
 * @returns {boolean}
 */
const isTradingHours = (tradingHours, utm) => {
  const currentUtm = moment(utm);
  let inHoursToTrade = false;
  _.forEach(tradingHours, (value) => {
    if ((value.days.includes(currentUtm.isoWeekday()))
      && (currentUtm.get('hour') >= value.start && currentUtm.get('hour') <= value.stop)) {
      inHoursToTrade = true;
    }
  });
  return inHoursToTrade;
};

/**
 * Open position
 *
 * @param cross
 * @param quote
 * @param strategy
 */
const openPosition = (cross, quote, strategy) => {
  let openPos = null;
  if (isTradingHours(strategy.tradingHours, quote.utm)) {
    const enterPrice = cross === 'XUP' ? (quote.bidOpen + strategy.spread) : (quote.askOpen - strategy.spread);
    const currentPrice = cross === 'XUP' ? quote.askOpen : quote.bidOpen;
    openPos = {
      startUtm: quote.utm,
      cross,
      enterPrice,
      high: currentPrice,
      low: currentPrice,
    };
  }
  return openPos;
};

/**
 * Backtest a strategy
 *
 * @param opt
 * @param cb
 */
const backtest = (opt, cb) => {
  const strategy = opt.strategy;
  const from = opt.from;
  const to = opt.to;
  log.info(opt);

  async.waterfall([
    (next) => {
      mongodb.connect(DB_URL, (err, db) => {
        if (err) {
          next(err);
        }
        db.collection('Quote')
          .find({
            epic: strategy.epic,
            utm: { $gte: moment(from).toDate(), $lt: moment(to).toDate() },
            resolution: `${strategy.resolution.nbUnit}${strategy.resolution.unit.toUpperCase()}`,
          }, { _id: 0 })
          .sort({ utm: 1 })
          .toArray((errToArray, quotes) => {
            db.close();
            next(errToArray, quotes);
          });
      });
    }, (quotes, next) => {
      const data = _.map(quotes, (quote) => getPriceFromQuote(quote));
      talib.execute({
        name: 'SMA',
        startIdx: 0,
        endIdx: data.length - 1,
        inReal: data,
        optInTimePeriod: strategy.sma,
      }, (result) => {
        const res = result.result.outReal;
        const sma = new Array(result.begIndex).fill(NaN).concat(res);
        next(null, quotes, sma);
      });
    }, (quotes, sma, next) => {
      let currentPos = null;
      const positions = [];
      for (let key = 1, l = quotes.length - 1; key < l; key++) {
        const cross = checkCross(quotes, sma, key);
        if (currentPos) {
          currentPos = updatePrices(currentPos, quotes[key], strategy.lotSize);
          currentPos = checkStops(currentPos, strategy);
          currentPos = closePosition(currentPos, cross, quotes[key + 1], strategy.lotSize);
          if (currentPos.isClosed) {
            positions.push(currentPos);
            currentPos = null;
          }
        }
        if (cross && !currentPos) {
          currentPos = openPosition(cross, quotes[key + 1], strategy);
          log.info(currentPos);
        }
      }
      log.info(positions);
      next();
    }], cb);
};

backtest({
  strategy: {
    epic: 'CS.D.EURUSD.MINI.IP',
    resolution: { unit: 'minute', nbUnit: 15 },
    sma: 45,
    lotSize: 10000,
    spread: 0.00007,
    stopLoss: -22,
    targetProfit: 18,
    tradingHours: [
      {
        days: [1, 2, 3, 4, 5],
        start: 2,
        stop: 4,
      }, {
        days: [1, 2, 3, 4, 5],
        start: 9,
        stop: 10,
      }, {
        days: [1, 2, 3, 4, 5],
        start: 13,
        stop: 17,
      },
    ],
  },
  from: '2016-12-03 00:00:00',
  to: '2016-12-10 00:00:00',
}, () => {
  log.info('Finished');
});

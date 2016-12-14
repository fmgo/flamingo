/**
 * Created by fmgo on 13/12/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const async = require('async');
const mongodb = require('mongodb');
const moment = require('moment');
const log = require('winston');
const _ = require('lodash');
const talib = require('talib');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'info',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

const DB_URL = 'mongodb://localhost:27017/fmgo-backtest';

const getPriceFromQuote = (quote) => parseFloat((quote.bidClose + ((quote.askClose - quote.bidClose) / 2)).toFixed(5));

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

const calcPips = (cross, currentPrice, enterPrice, pipValue) => {
  let currentPipProfit = ((currentPrice - enterPrice) * pipValue).toFixed(1);
  currentPipProfit = cross === 'XUP' ?
  1 * currentPipProfit :
  -1 * currentPipProfit;
  return currentPipProfit;
};

const updateProfits = (position, strategy) => {
  const updatedPos = position;
  const highProfit = calcPips(position.cross, updatedPos.high, updatedPos.enterPrice, strategy.pipValue);
  const lowProfit = calcPips(position.cross, updatedPos.low, updatedPos.enterPrice, strategy.pipValue);
  updatedPos.profit = calcPips(position.cross, updatedPos.price, updatedPos.enterPrice);
  updatedPos.win = position.cross === 'XUP' ? highProfit : lowProfit;
  updatedPos.loss = position.cross === 'XUP' ? lowProfit : highProfit;
  return updatedPos;
};

const updatePrices = (position, quote) => {
  let updatedPos = position;
  const currentHigh = position.cross === 'XUP' ? quote.bidHigh : quote.askHigh;
  const currentLow = position.cross === 'XUP' ? quote.bidLow : quote.askLow;
  updatedPos.price = updatedPos.cross === 'XUP' ? quote.bidClose : quote.askClose;
  updatedPos.high = Math.max(position.high, currentHigh);
  updatedPos.low = Math.min(position.low, currentLow);
  return updateProfits(updatedPos);
};

const checkStops = (position, strategy) => {
  const stoppedPos = position;
  if (position.loss <= strategy.stopLoss) {
    stoppedPos.isStopped = true;
    stoppedPos.exitProfit = strategy.stopLoss;
  }
  if (position.win >= position.targetProfit) {
    stoppedPos.isStopped = true;
    stoppedPos.exitProfit = strategy.targetProfit;
  }
  return stoppedPos;
};


const backtest = (opt, cb) => {
  const strategy = opt.strategy;
  const from = opt.from;
  const to = opt.to;

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
            resolution: `${strategy.resolution.nbUnit}${strategy.resolution.unit}`,
          }, { _id: 0 })
          .sort({ utm: 1 })
          .toArray((errToArray, quotes) => {
            db.close();
            next(errToArray, quotes);
          });
      });
    }, (quotes, next) => {
      const data = _.map(quotes, (quote) => getPriceFromQuote(quote));
      // log.info(data);
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
      for (let key = 1, l = quotes.length; key < l; key++) {
        if (currentPos) {
          currentPos = updatePrices(currentPos, quotes[key]);
          currentPos = checkStops(currentPos, strategy);
          if (currentPos.isStopped) {
            currentPos.exitUtm = quotes[key].utm;
            positions.push(currentPos);
            currentPos = null;
          }
        }
        const cross = checkCross(quotes, sma, key);
      }
      next();
    }], cb);
};

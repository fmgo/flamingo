/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const _ = require('lodash');
const log = require('winston');
const indicators = require('./indicators');

/**
 * Callback for calcSma.
 *
 * @callback smaCrossPriceCallback
 * @param {String} [error=null] - Error first.
 * @param {Object} [results]  - XUP/XDOWN if prices cross up/down the sma and metadata
 */
/**
 * Check if the Prices cross UP or Down the simple moving average
 *
 * @param {Array} prices The prices to analyse
 * @param {Number} nbPoints Number of points for the average
 * @param {smaCrossPriceCallback} callback
 */
const smaCrossPrice = (prices, nbPoints, callback) => {
  indicators.calcSma(prices, nbPoints, (err, sma) => {
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const currentSma = sma[sma.length - 1];
    const prevSma = sma[sma.length - 2];
    const signal = indicators.calcCross(prevPrice, currentSma, currentPrice, prevSma);
    callback(null, { signal, meta: { prevPrice, currentSma, currentPrice, prevSma } });
  });
};

const getStopPips = (data, nbPoints, ratio, callback) => {
  const high = _.map(data, (quote) => parseFloat((quote.bidHigh + ((quote.askHigh - quote.bidHigh) / 2)).toFixed(5)));
  const low = _.map(data, (quote) => parseFloat((quote.bidLow + ((quote.askLow - quote.bidLow) / 2)).toFixed(5)));
  const close = _.map(data, (quote) => parseFloat((quote.bidClose + ((quote.askClose - quote.bidClose) / 2)).toFixed(5)));
  indicators.calcAtr({ high, low, close }, nbPoints, (err, res) => {
    if (err || !res) {
      log.error(err || 'No Result');
      callback(err || 'No Atr returned');
    } else {
      const stopPips = res * ratio;
      callback(null, stopPips);
    }
  });
};

const calcTrend = (prices, nbPoints, callback) => {
  indicators.calcSma(prices, nbPoints, (err, sma) => {
    const currentPrice = prices[prices.length - 1];
    const currentSma = sma[sma.length - 1];
    let trend = null;
    if (currentSma) {
      trend = currentPrice >= currentSma ? 'UP' : 'DOWN';
    }
    callback(null, { trend, meta: { currentPrice, currentSma } });
  });
};

exports.smaCrossPrice = smaCrossPrice;
exports.getStopPips = getStopPips;
exports.calcTrend = calcTrend;

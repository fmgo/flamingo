/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
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

exports.smaCrossPrice = smaCrossPrice;

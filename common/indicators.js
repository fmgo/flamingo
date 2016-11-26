/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const talib = require('talib');

/**
 * Calc if two values crosses
 * If val Short (eg. Price or Short sma) cross up
 * val Long (eg. Sma for price or Sma Long) it return XUP
 * Else if valShort cross down val Long it return XDOWN
 * else it return null
 *
 * @param {Number} prevValShort The previous (n-1) Short value
 * @param {Number} prevValLong The previous (n-1) Long Value
 * @param {Number} currentValShort The current short value
 * @param {Number} currentValLong The current long value
 * @returns {String} [Signal=null] Return 'XUP' || 'XDOWN'
 */
const calcCross = (prevValShort, prevValLong, currentValShort, currentValLong) => {
  let result = null;
  if (prevValShort && prevValLong && currentValShort && currentValLong) {
    if (prevValShort <= prevValLong && currentValShort > currentValLong) {
      result = 'XUP';
    } else if (prevValShort >= prevValLong && currentValShort < currentValLong) {
      result = 'XDOWN';
    }
  }
  return result;
};

/**
 * Callback for calcSma.
 *
 * @callback calcSmaCallback
 * @param {String} [error=null] - Error first.
 * @param {Array} sma - The moving average.
 */
/**
 * Calc simple moving average for the data passed in params
 *
 * @param {Array} data The Array of value to calc
 * @param {Number} nbPoints Number of points for the average
 * @param {calcSmaCallback} callback - A callback to run.
 */
const calcSma = (data, nbPoints, callback) => {
  talib.execute({
    name: 'SMA',
    startIdx: 0,
    endIdx: data.length - 1,
    inReal: data,
    optInTimePeriod: nbPoints,
  }, (result) => {
    const sma = result.result.outReal;
    callback(null, sma);
  });
};

/**
 * Callback for calcAtr.
 *
 * @callback calcAtrCallback
 * @param {String} [error=null] - Error first.
 * @param {Array} sma - The average true range.
 */
/**
 * Calc average true range for the quotes passed in params
 *
 * @param {Object} data The Array of quotes to calc
 * @param {Number} nbPoints Number of points for the average
 * @param {calcAtrCallback} callback - A callback to run.
 */
const calcAtr = (data, nbPoints, callback) => {
  const high = data.high;
  const low = data.low;
  const close = data.close;
  talib.execute({
    name: 'ATR',
    high,
    low,
    close,
    startIdx: 0,
    endIdx: close.length - 1,
    optInTimePeriod: nbPoints,
  }, (result) => {
    const atr = result.result.outReal;
    callback(null, atr[atr.length - 1]);
  });
};

/**
 * Exports API
 */
exports.calcCross = calcCross;
exports.calcSma = calcSma;
exports.calcAtr = calcAtr;

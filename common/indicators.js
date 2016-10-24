/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const _ = require('lodash');
const talib = require('talib');

/**
 * Calculate the average of an array of Number or object
 * if nbPoints is passed it will calculate the average on
 * the last n values of the array
 *
 * @param items Array of Number or Object
 * @param [key] Field of the object in array
 * @param [nbPoints] Calculate average on the last n values
 * @returns {Number} The average
 */
const calcAverage = (items, key, nbPoints) => {
  if (!items || nbPoints > items.length) {
    return NaN;
  }
  let itemsToCalc = items;
  if (nbPoints) {
    itemsToCalc = items.slice(items.length - nbPoints, items.length);
  }
  if (key) {
    itemsToCalc = _.map(itemsToCalc, key);
  }
  return _.sum(itemsToCalc) / itemsToCalc.length;
};

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
 * Exports API
 */
exports.calcAverage = calcAverage;
exports.calcCross = calcCross;
exports.calcSma = calcSma;

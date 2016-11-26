/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const _ = require('lodash');
const moment = require('moment');

/**
 * Calculate the position profit
 *
 * @param {Object} position The Position
 * @returns {Object} position Position with profits value (Pip, Base, Euro)
 */
const getPipProfit = (position) => {
  const currentPrice = position.currentPrice;
  const contractSize = position.contractSize;
  const lotSize = position.lotSize;
  let currentPipProfit = ((currentPrice - position.openPrice) * contractSize / lotSize).toFixed(1);
  currentPipProfit = position.direction === 'BUY' ?
  1 * currentPipProfit :
  -1 * currentPipProfit;
  return currentPipProfit;
};

/**
 * Calculate the position size
 *
 * @param {Number} balance The current account balance
 * @param {Number} price
 * @param {Number} risk The strategy to apply
 * @param {Number} stop The strategy to apply
 * @param {Number} lotSize  The lot size of the epic
 */
const calcPositionSize = (balance, price, risk, stop, lotSize) =>
  (Math.abs((balance * risk * price) / stop) / lotSize).toFixed();

/**
 * Calc position profit with profit in euro and in base currency
 * also keep Max and Min profit for analyse later...
 *
 * TODO use getProfit...
 *
 * @param position
 * @param basePrice
 * @returns {*}
 */
const calcPositionProfit = (position, basePrice) => {
  const size = Number(position.size);
  const currentPrice = position.currentPrice;
  const contractSize = position.contractSize;
  const lotSize = position.lotSize;
  const positionProfits = position;
  let currentProfit = ((currentPrice - position.openPrice) * contractSize / lotSize).toFixed(1);
  currentProfit = position.direction === 'BUY' ?
  1 * currentProfit :
  -1 * currentProfit;
  const pipPrice = (lotSize / contractSize) / currentPrice;
  if (!positionProfits.maxProfit || positionProfits.maxProfit < currentProfit) {
    positionProfits.maxProfit = currentProfit;
  }
  if (!positionProfits.minProfit || positionProfits.minProfit > currentProfit) {
    positionProfits.minProfit = currentProfit;
  }
  positionProfits.currentProfit = currentProfit;
  positionProfits.profitBase = (currentProfit * pipPrice) * size * lotSize * contractSize;
  positionProfits.profitEuro = currentProfit * basePrice * size * lotSize;
  return positionProfits;
};

/**
 * Check if market is open...
 *
 * From Sunday 23h to Friday 23h
 * @param utm
 * @returns {boolean}
 */
const isMarketOpen = (utm) => {
  const day = utm.utc().isoWeekday();
  const hour = utm.utc().get('hour');
  return !((day === 5 && hour > 20) || day === 6 || (day === 7 && hour <= 20));
};

/**
 * Calc expectancy according to the transactions
 *
 * @param {Array} transactions
 * @returns {Object} results
 */
const calcExpectancy = (transactions) => {
  const results = _.reduce(transactions, (res, trade) => {
    const finalResult = res;
    if (trade.currentProfit > 0) {
      finalResult.win++;
      finalResult.winProfit += trade.currentProfit;
    } else {
      finalResult.loose++;
      finalResult.looseProfit += trade.currentProfit;
    }
    return res;
  }, {
    win: 0,
    loose: 0,
    winProfit: 0,
    looseProfit: 0,
  });

  if (results.win > 0) {
    results.averageWin = results.winProfit / results.win;
  }

  if (results.loose > 0) {
    results.averageLoose = -1 * results.looseProfit / results.loose;
  }

  if (results.averageWin && results.averageLoose) {
    results.percentWL = results.win / (results.win + results.loose);
    results.excpectancy = (1 + (results.averageWin / results.averageLoose)) * results.percentWL - 1;
  } else {
    results.excpectancy = 0;
  }
  return results;
};

const isPositionStopped = (position) => {
  let isStopped = false;
  if (position.direction === 'BUY' && position.currentPrice <= position.stopPrice) {
    isStopped = true;
  }
  if (position.direction === 'SELL' && position.currentPrice >= position.stopPrice) {
    isStopped = true;
  }
  if (moment(position.currentDate).get('hour') >= 21 && moment(position.currentDate).get('minute') >= 45) {
    isStopped = true;
  }
  return isStopped;
};

/**
 * Generate and log the report from the context analysed
 *
 * @param context
 * @param callback
 */
const getReport = (context, callback) => {
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
    price: context.price,
    balance: context.account.balance,
    targetProfit: context.targetProfit,
    stopDistance: context.stopDistance,
    position,
    quote: context.quote || context.minQuote,
    smaValue: context.smaValue,
    smaCrossPrice: context.smaCrossPrice,
    trendValue: context.trendValue,
    trend: context.trend,
    openPos: context.openOrder ? 'YES' : 'NO',
    closePos: context.closeOrder ? 'YES' : 'NO',
  };
  process.nextTick(() => {
    callback(null, report);
  });
};

exports.getPipProfit = getPipProfit;
exports.calcPositionSize = calcPositionSize;
exports.calcPositionProfit = calcPositionProfit;
exports.isMarketOpen = isMarketOpen;
exports.calcExpectancy = calcExpectancy;
exports.isPositionStopped = isPositionStopped;
exports.getReport = getReport;

/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

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

exports.getPipProfit = getPipProfit;
exports.calcPositionSize = calcPositionSize;
exports.calcPositionProfit = calcPositionProfit;
exports.isMarketOpen = isMarketOpen;

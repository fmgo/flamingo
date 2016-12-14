/**
 * Created by fmgo on 05/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const moment = require('moment');
const log = require('winston');
const _ = require('lodash');
const push = require('pushover-notifications');
const config = require('../config');

/**
 * Calculate the position profit
 *
 * @param {Object} position The Position
 * @returns {Object} position Position with profits value (Pip, Base, Euro)
 */
const getPipProfit = (position) => {
  let currentPipProfit = null;
  if (position) {
    const currentPrice = position.currentPrice;
    const contractSize = position.contractSize;
    const lotSize = position.lotSize;
    currentPipProfit = ((currentPrice - position.openPrice) * contractSize / lotSize).toFixed(1);
    currentPipProfit = position.direction === 'BUY' ?
    1 * currentPipProfit :
    -1 * currentPipProfit;
  }
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
  Math.floor(Math.abs((balance * risk * price) / stop) / lotSize);

/**
 * Check if position need to be closed
 *
 * @param context
 */
const isPositionStopped = (context) => (context.position
        && ((context.position.currentProfit >= context.limitDistance)
        || (context.position.currentProfit <= (-1 * context.stopDistance))
        || (moment(context.position.currentDate).get('hour') >= context.strategy.tradingHours.stop)));

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
    targetProfit: context.strategy.targetProfit,
    stopLoss: context.strategy.stopLoss,
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

const isTradingHours = (utm, strategy) => {
  const currentUtm = moment(utm);
  let inHoursToTrade = false;
  _.forEach(strategy.tradingHours, (value) => {
    if ((value.days.includes(currentUtm.isoWeekday()))
      && (currentUtm.get('hour') >= value.start && currentUtm.get('hour') <= value.stop)) {
      inHoursToTrade = true;
    }
  });
  log.info('is Trading hour ? ', { isoWeekDay: currentUtm.isoWeekday(), Hours:currentUtm.get('hour') ,  inHoursToTrade});
  return inHoursToTrade;
};


/**
 * Check if market is open...
 *
 * From Sunday 23h to Friday 23h
 * @param utm
 * @returns {boolean}
 */
const isMarketOpen = (utm) => {
  const date = moment(utm);
  const day = date.utc().isoWeekday();
  const hour = date.utc().get('hour');
  const isOpen = !((day === 5 && hour > 20) || day === 6 || (day === 7 && hour <= 20));
  log.verbose(`Market is open: ${date} => ${isOpen}`);
  return isOpen;
};

const pushReport = (report, cb) => {
  const p = new push({
    user: config.PUSHOVER_USER,
    token: config.PUSHOVER_TOKEN,
  });
  if (report.openPos === 'YES') {
    const msg = {
      // These values correspond to the parameters detailed on https://pushover.net/api
      // 'message' is required. All other values are optional.
      message: `Open Position: ${report.epic}`,	// required
    };

    p.send(msg, (err, result) => {
      if (err) {
        cb(err);
      }
      cb(null, result);
    });
  } else if (report.closePos === 'YES') {
    const msg = {
      // These values correspond to the parameters detailed on https://pushover.net/api
      // 'message' is required. All other values are optional.
      message: `Close Position: ${report.epic}`,	// required
    };

    p.send(msg, (err, result) => {
      if (err) {
        cb(err);
      }
      cb(null, result);
    });
  } else {
    cb();
  }
};

exports.getPipProfit = getPipProfit;
exports.calcPositionSize = calcPositionSize;
exports.isPositionStopped = isPositionStopped;
exports.getReport = getReport;
exports.isMarketOpen = isMarketOpen;
exports.isTradingHours = isTradingHours;
exports.pushReport = pushReport;

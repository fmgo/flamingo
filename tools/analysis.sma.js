/**
 * Created by fmgo on 01/12/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const mongodb = require('mongodb');
const async = require('async');
const moment = require('moment');
const _ = require('lodash');
const talib = require('talib');
const log = require('winston');
const json2csv = require('json2csv');
const fs = require('fs');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'info',
  colorize: true,
  stringify: true,
  prettyPrint: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

const DB_URL = 'mongodb://192.168.0.50:27017/fmgo';
// const DB_URL = 'mongodb://localhost:27017/fmgo-backtest';

const EPIC = 'CS.D.EURUSD.MINI.IP';
const reso = {nbUnit: 15, unit: 'minute'};
const RESOLUTION = `${reso.nbUnit}${reso.unit.toUpperCase()}`;
const PIP_VALUE = 10000;
const SPREAD = 0.00009;

const MA_TYPE = 'SMA';

const WEEKS = [
  // {
  //   start: '2016-09-10 00:00:00',
  //   end: '2016-09-16 00:00:00',
  // },
  // {
  //   start: '2016-09-17 00:00:00',
  //   end: '2016-09-24 00:00:00',
  // },
  // {
  //   start: '2016-10-01 00:00:00',
  //   end: '2016-10-08 00:00:00',
  // },
  // {
  //   start: '2016-10-08 00:00:00',
  //   end: '2016-10-15 00:00:00',
  // },
  // {
  //   start: '2016-10-15 00:00:00',
  //   end: '2016-10-22 00:00:00',
  // },
  // {
  //   start: '2016-10-22 00:00:00',
  //   end: '2016-10-29 00:00:00',
  // },
  // {
  //   start: '2016-10-29 00:00:00',
  //   end: '2016-11-05 00:00:00',
  // },
  // {
  //   start: '2016-11-05 00:00:00',
  //   end: '2016-11-12 00:00:00',
  // },
  // {
  //   start: '2016-11-12 00:00:00',
  //   end: '2016-11-19 21:00:00',
  // },
  // {
  //   start: '2016-11-19 00:00:00',
  //   end: '2016-11-26 00:00:00',
  // },
  // {
  //   start: '2016-11-26 00:00:00',
  //   end: '2016-12-03 00:00:00',
  // },
  // {
  //   start: '2016-12-03 00:00:00',
  //   end: '2016-12-10 00:00:00',
  // },
  {
    start: '2016-12-11 20:00:00',
    end: '2016-12-14 00:15:00',
  },
];

const checkCross = (prevValShort, prevValLong, currentValShort, currentValLong) => {
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

const getPrice = (quote) => parseFloat((quote.bidClose + ((quote.askClose - quote.bidClose) / 2)).toFixed(5));

const calcNbPip = (cross, crossPrice, currentPrice) => {
  let currentPipProfit = ((crossPrice - currentPrice) * PIP_VALUE).toFixed(1);
  currentPipProfit = cross === 'XUP' ?
  1 * currentPipProfit :
  -1 * currentPipProfit;
  return currentPipProfit;
};

const isTradingHours = (utm) => {
  const currentUtm = moment(utm).add(reso.nbUnit, reso.unit);
  let inHoursToTrade = false;
  if (
      ((currentUtm.get('hour') >= 2) && (currentUtm.get('hour') <= 4))
  || ((currentUtm.get('hour') >= 9) && (currentUtm.get('hour') <= 10))
  || ((currentUtm.get('hour') >= 13) && (currentUtm.get('hour') <= 17))
  // || (currentUtm.get('hour') >= 18 && currentUtm.get('hour') <= 21)
    ) {
    inHoursToTrade = true;
  }
  return inHoursToTrade;
};

const analyseSma = (quotes, sma, SL, TP, cb) => {
  const trades = [];
  let lastCrossUtm = null;
  let winningTrades = 0;
  let winningProfit = 0;
  let exitedWinningTrades = 0;
  let loosingTrades = 0;
  let loosingProfit = 0;
  let exitedLoosingTrades = 0;
  let drawTrades = 0;
  let totalProfit = 0;
  const res = _.reduce(quotes, (result, value, key) => {
    if (key > 1 && quotes[key + 1]) {
      const prevPrice = getPrice(quotes[key - 1]);
      const currentPrice = getPrice(value);
      const prevSma = parseFloat(sma[key - 1].toFixed(5));
      const currentSma = parseFloat(sma[key].toFixed(5));
      const cross = checkCross(prevPrice, prevSma, currentPrice, currentSma);
      if (lastCrossUtm !== null) {
        const currentRes = result[lastCrossUtm];
        currentRes.lastUtm = value.utm;
        const currentHigh = currentRes.cross === 'XUP' ? value.bidHigh : value.askHigh;
        const currentLow = currentRes.cross === 'XUP' ? value.bidLow : value.askLow;
        currentRes.duration = moment(value.utm).diff(moment(lastCrossUtm), 'minute');
        if (currentRes.high < currentHigh) {
          currentRes.high = currentHigh;
          currentRes.highTime = currentRes.duration;
        }
        if (currentRes.low > currentLow) {
          currentRes.low = currentLow;
          currentRes.lowTime = currentRes.duration;
        }
        const highProfit = calcNbPip(currentRes.cross, currentRes.high, currentRes.enterPrice);
        const lowProfit = calcNbPip(currentRes.cross, currentRes.low, currentRes.enterPrice);
        currentRes.win = currentRes.cross === 'XUP' ? highProfit : lowProfit;
        currentRes.loss = currentRes.cross === 'XUP' ? lowProfit : highProfit;
        if (currentRes.loss <= SL && !currentRes.stopped && !currentRes.targetHit) {
          currentRes.stopped = true;
          currentRes.exitPrice = '-';
          currentRes.exitProfit = SL;
          currentRes.exitUtm = value.utm;
          loosingTrades++;
          loosingProfit += SL;
          totalProfit += currentRes.exitProfit;
        }
        if (currentRes.win >= TP && !currentRes.stopped && !currentRes.targetHit) {
          currentRes.targetHit = true;
          currentRes.exitPrice = '-';
          currentRes.exitProfit = TP;
          currentRes.exitUtm = value.utm;
          winningTrades++;
          winningProfit += TP;
          totalProfit += currentRes.exitProfit;
        }
        currentRes.winTime = currentRes.cross === 'XUP' ? currentRes.highTime : currentRes.lowTime;
        currentRes.lossTime = currentRes.cross === 'XUP' ? currentRes.lowTime : currentRes.highTime;
        result[currentRes.startUtm] = currentRes;
      }
      if (cross) {
        if (lastCrossUtm) {
          if (!result[lastCrossUtm].stopped && !result[lastCrossUtm].targetHit) {
            result[lastCrossUtm].exitPrice = result[lastCrossUtm].cross === 'XUP' ? quotes[key + 1].bidOpen : quotes[key + 1].askOpen;
            result[lastCrossUtm].exitProfit = calcNbPip(result[lastCrossUtm].cross, result[lastCrossUtm].exitPrice, result[lastCrossUtm].enterPrice);
            result[lastCrossUtm].exitUtm = value.utm;
            totalProfit += result[lastCrossUtm].exitProfit;
            if (result[lastCrossUtm].exitProfit === 0) {
              drawTrades++;
            } else if (result[lastCrossUtm].exitProfit > 0) {
              exitedWinningTrades++;
              winningProfit += result[lastCrossUtm].exitProfit;
            } else if (result[lastCrossUtm].exitProfit < 0) {
              exitedLoosingTrades++;
              loosingProfit += result[lastCrossUtm].exitProfit;
            }
          }
          //log.info(result[lastCrossUtm]);
          trades.push(result[lastCrossUtm]);
        }
        if (isTradingHours(value.utm)) {
          log.info('ENTER', moment(value.utm).add(reso.nbUnit, reso.unit).format());
          lastCrossUtm = value.utm;
          const enterPrice = cross === 'XUP' ? (quotes[key + 1].bidOpen + SPREAD) : (quotes[key + 1].askOpen - SPREAD);
          const currentHigLow = cross === 'XUP' ? quotes[key + 1].askOpen : quotes[key + 1].bidOpen;
          result[value.utm] = {
            startUtm: moment(value.utm).add(reso.nbUnit, reso.unit).toDate(),
            cross,
            enterPrice,
            currentSma,
            high: currentHigLow,
            highTime: 0,
            low: currentHigLow,
            lowTime: 0,
          };
        } else {
          lastCrossUtm = null;
        }
      }
    }
    return result;
  }, {});
  // log.info(res);
  cb(null, {
    stats: {
      winningTrades,
      winningProfit,
      loosingTrades,
      loosingProfit,
      drawTrades,
      exitedLoosingTrades,
      exitedWinningTrades,
      totalProfit,
    },
    trades,
  });
};

const analyseWeek = (week, maValue, stopLoss, targetProfit, cb) => {
  const from = week.start;
  const to = week.end;
  async.waterfall([
    (next) => {
      mongodb.connect(DB_URL, (err, db) => {
        if (err) {
          next(err);
        }
        db.collection('Quote')
          .find({
            epic: EPIC,
            utm: { $gte: moment(from).toDate(), $lt: moment(to).toDate() },
            resolution: RESOLUTION,
          }, { _id: 0 })
          .sort({ utm: 1 })
          .toArray((errToArray, quotes) => {
            db.close();
            next(errToArray, quotes);
          });
      });
    }, (quotes, next) => {
      const data = _.map(quotes, (quote) => getPrice(quote));
      // log.info(data);
      talib.execute({
        name: MA_TYPE,
        startIdx: 0,
        endIdx: data.length - 1,
        inReal: data,
        optInTimePeriod: maValue,
      }, (result) => {
        const res = result.result.outReal;
        const sma = new Array(result.begIndex).fill(NaN).concat(res);
        next(null, quotes, sma);
      });
    }, (quotes, sma, next) => {
      analyseSma(quotes, sma, stopLoss, targetProfit, next);
    }], cb);
};

const analyseWeeks = (weeks, sma, stopLoss, targetProfit, trailingStop, cb) => {
  const globalResult = {
    sma,
    stopLoss,
    targetProfit,
    winningTrades: 0,
    exitedWinningTrades: 0,
    loosingTrades: 0,
    exitedLoosingTrades: 0,
    drawTrades: 0,
    winningProfit: 0,
    loosingProfit: 0,
    totalProfit: 0,
  };
  const results = [];
  const trades = [];
  async.eachSeries(weeks, (week, callback) => {
    analyseWeek(week, sma, stopLoss, targetProfit, (err, resAnalyse) => {
      if (err) { log.error(err);}
      const res = resAnalyse.stats;
      results.push(res);
      globalResult.winningTrades += res.winningTrades;
      globalResult.exitedWinningTrades += res.exitedWinningTrades;
      globalResult.loosingTrades += res.loosingTrades;
      globalResult.exitedLoosingTrades += res.exitedLoosingTrades;
      globalResult.drawTrades += res.drawTrades;
      globalResult.winningProfit += res.winningProfit;
      globalResult.loosingProfit += res.loosingProfit;
      globalResult.totalProfit += res.totalProfit;
      trades.push(...resAnalyse.trades);
      callback(err);
    });
  }, (err) => {
    const winRatio = (globalResult.winningTrades + globalResult.exitedWinningTrades) / trades.length;
    const lossRatio = 1 - winRatio;
    const averageWin = globalResult.winningProfit / (globalResult.winningTrades + globalResult.exitedWinningTrades);
    const averageLoss = globalResult.loosingProfit / (globalResult.loosingTrades + globalResult.exitedLoosingTrades);
    // log.info(`${winRatio}, ${lossRatio}`);
    log.info(`${averageWin}, ${averageLoss}`);
    const RR = averageWin / averageLoss;
    // log.info(`${RR}`);
    const exp = (1 + RR) * (winRatio - 1);
    globalResult.exp = exp;
    cb(err, { results, globalResult, trades });
  });
};

const runAnalysis = (opt, cb) => {
  let bestStrategy = null;
  let bestStrategyExp = null;
  let weekResultsExp;
  let weekResults;
  let trades;
  async.eachSeries(opt.sma_values, (sma, callback) => {
    log.profile(`SMA-${opt.sma_values}`);
    let currentTp = opt.tp_range[0];
    const endTp = opt.tp_range[1];
    let bestSmaStrategyExp = null;
    let bestSmaStrategy = null;
    async.whilst(
      () => currentTp <= endTp,
      (nextTp) => {
        let currentSl = opt.sl_range[0];
        const endSl = opt.sl_range[1];
        async.whilst(
          () => currentSl <= endSl,
          (nextSl) => {
            analyseWeeks(opt.weeks, sma, currentSl, currentTp, currentSl, (err, res) => {
              log.info(`Total profit sma:${sma} sl:${currentSl} tp:${currentTp} profit:${res.globalResult.totalProfit} exp: ${res.globalResult.exp}`);
              if (!bestStrategy || bestStrategy.totalProfit < res.globalResult.totalProfit) {
                bestStrategy = res.globalResult;
                weekResults = res.results;
                trades = res.trades;
              }
              if (!bestSmaStrategy || bestSmaStrategy.totalProfit < res.globalResult.totalProfit) {
                bestSmaStrategy = res.globalResult;
              }
              if (!bestStrategyExp || bestStrategyExp.exp < res.globalResult.exp) {
                bestStrategyExp = res.globalResult;
                weekResultsExp = res.results;
              }
              if (!bestSmaStrategyExp || bestSmaStrategyExp.exp < res.globalResult.exp) {
                bestSmaStrategyExp = res.globalResult;
              }
              currentSl++;
              nextSl(err);
            });
          }, (err) => {
            currentTp++;
            nextTp(err);
          });
      }, (err) => {
        log.info('Best sma strategy', bestSmaStrategy);
        log.info('Best Exp sma strategy', bestSmaStrategyExp);
        log.profile(`SMA-${opt.sma_values}`);
        callback(err);
      });
  }, (err) => {
    cb(err, { bestStrategy, bestStrategyExp, weekResults, weekResultsExp, trades });
  });
};

runAnalysis({
  tp_range: [18, 18],
  sl_range: [-22, -22],
  weeks: WEEKS,
  sma_values: [45],
}, (err, result) => {
  log.info(result.weekResults);
  log.info(result.trades.length);
  log.info(result.weekResultsExp);
  log.info(result.bestStrategy);
  log.info(result.bestStrategyExp);
  const toCsv = [];
  _.forEach(result.trades, (value) => {
    const enterDate = moment(value.startUtm);
    toCsv.push({
      enterDate: enterDate.format(),
      dayOfWeek: enterDate.format('e'),
      hour: enterDate.format('HH'),
      direction: value.cross,
      // enterPrice: value.enterPrice,
      // exitDate: moment(value.exitUtm).format(),
      // exitPrice: value.exitPrice,
      profit: value.exitProfit,
      stopped: (value.stopped || value.targetHit || false),
      duration: value.duration,
      maxWin: value.win,
      maxWinTime: value.winTime,
      maxLoss: value.loss,
      maxLossTime: value.lossTime,
    });
  });
  try {
    const csv = json2csv({
      data: toCsv,
      fields: Object.keys(toCsv[0]),
    });
    fs.writeFile('trades-hours.csv', csv, (errWrite) => {
      if (errWrite) throw errWrite;
      log.info('file saved');
    });
  } catch (errCatched) {
    log.error(errCatched);
  }
});

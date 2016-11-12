/**
 * Created by fmgo on 22/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const async = require('async');
const log = require('winston');
const _ = require('lodash');
const Trader = require('./Trader');
const database = require('./common/database');

log.remove(log.transports.Console);
log.add(log.transports.Console, {
  level: 'info',
  colorize: true,
  handleExceptions: true,
  humanReadableUnhandledException: true,
});

const market = {
  epic: 'CS.D.EURUSD.MINI.IP',
  lotSize: 1,
  contractSize: 10000,
  currencyCode: 'USD',
};

const weeks = [
  { from: '2016-09-12T21:10:00.000Z', to: '2016-09-17T21:10:00.000Z', balance: 4500 },
  { from: '2016-09-17T21:10:00.000Z', to: '2016-09-24T21:10:00.000Z', balance: 4500 },
  { from: '2016-09-24T21:10:00.000Z', to: '2016-10-01T21:10:00.000Z', balance: 4500 },
  { from: '2016-10-01T21:10:00.000Z', to: '2016-10-08T21:10:00.000Z', balance: 4500 },
  { from: '2016-10-08T21:10:00.000Z', to: '2016-10-15T21:10:00.000Z', balance: 4500 },
  { from: '2016-10-15T21:10:00.000Z', to: '2016-10-21T21:10:00.000Z', balance: 4500 },
];

const nbPop = 20;
const smaValues = {min: 10, max: 60};
const stopLossValues = {min: 1, max: 15};
const trailingStopValues = {min: 1, max:15};
const riskValues = {min: 1, max: 5};

const getRandomBetween = (opt) => {
  return Math.floor(Math.random()*(opt.max-opt.min+1)+opt.min);
};

const getRandomResolution = () => {
  const resolutions = [5,10,15,30];
  const id = getRandomBetween({min: 1, max: resolutions.length});
  return {
    unit: 'minute',
    nbUnit: resolutions[id-1],
  };
};

const createRandomStrategies = (opt, cb) => {
  const strategies = [];
  for (var id = 0; id < opt.nbPop; id++) {
    var strategy = {
      resolution: getRandomResolution(),
      sma: getRandomBetween(opt.smaValues),
      stopLoss: -1 * getRandomBetween(opt.stopLossValues),
      trailingStop: -1 * getRandomBetween(opt.trailingStopValues),
      risk: getRandomBetween(opt.riskValues)/100,
    };
    strategies.push(strategy);
  }
  cb(null, strategies);
};

const normalizeResults = (strategies) => {
  const minVal = strategies[0].result;
  let normResults = strategies;
  if (minVal < 0) {
    normResults = _.map(strategies, (strategy) => {
      strategy.result += (-1 * minVal);
      return strategy
    });
  }
  return normResults;
};

const disqualifyBadTrader = (strategies) => {
  return strategies.slice(strategies.length/2, strategies.length);
};

const getParent = (strategies) => {
  const sortedStrat = strategies;
  let newStrat = null;
  sortedStrat.sort(function(a,b) {return (a.prob > b.prob) ? 1 : ((b.prob > a.prob) ? -1 : 0);} );
  const numb = Math.random();
  let i = 0;
  for (i; i < sortedStrat.length-1; i++) {
    if (numb > sortedStrat[i].prob && numb < sortedStrat[i+1].prob) {
      newStrat = sortedStrat[i];
      return newStrat;
    }
  }
  if (newStrat === null) {
    log.error('No parent selected...', {numb, strategies});
  }
};

const crossOver = (father, mother) => {
  var newStrat = {
    resolution:  Math.random() > 0.5 ? {unit: father.resolution.unit, nbUnit: father.resolution.nbUnit} :
    {unit: mother.resolution.unit, nbUnit: mother.resolution.nbUnit},
    sma: Math.random() > 0.5 ? father.sma : mother.sma,
    stopLoss: Math.random() > 0.5 ? father.stopLoss : mother.stopLoss,
    trailingStop: Math.random() > 0.5 ? father.trailingStop : mother.trailingStop,
    risk: Math.random() > 0.5 ? father.risk : mother.risk,
  };
  return newStrat;
};

const generateStrategies = (oldPop, cb) => {
  const newPop = normalizeResults(oldPop);
  const sum = _.reduce(newPop, (sum, strategy) => {
    return sum + strategy.result;
  }, 0);
  // oldPop.sort(function(a,b) {return (a.result > b.result) ? 1 : ((b.result > a.result) ? -1 : 0);} );
  let sumProb = 0;
  const popProb  = _.map(newPop, (strategy) => {
    strategy.prob = sumProb + (strategy.result / sum);
    sumProb = strategy.prob;
    return strategy;
  });
  async.whilst(
    () =>  newPop.length < nbPop,
    (cb) => {
      let father = getParent(popProb);
      let mother = getParent(popProb);
      let newStrat = crossOver(father, mother);
      newPop.push(newStrat);
      cb(null);
    },
    (err) => {
      cb(err, newPop);
    }
  )
};

const battle = (strategies, round, callback) => {
  var results = [];
  let btOpt = weeks[round];
  log.info(btOpt);
  let count = 0;
  log.profile(`ROUND#${round}`);
  async.each(strategies, (strategy, cb) => {
    count++;
    btOpt.name = `Chico#${count}`;
    delete strategy.result;
    delete strategy.prob;
    log.info(`Start backtest ${count} round ${round}`, strategy);
    log.profile(`backtest Chico#${count}`);
    var trader = new Trader(market, strategy);
    trader.backtest(btOpt, (err, res) => {
      if (err) {
        log.error(err);
        return cb(err);
      } else {
        log.info(err, res);
        strategy.result = res.excpectancy;
        log.profile(`backtest Chico#${count}`);
        log.info(`Result`, res);
        log.info('\n\n\n');
        results.push(strategy);
        cb();
      }
    });
  }, (err) => {
    results.sort(function(a,b) {return (a.result > b.result) ? 1 : ((b.result > a.result) ? -1 : 0);} );
    const newPop = disqualifyBadTrader(results);
    log.profile(`ROUND#${round}`);
    round++;
    log.info('Result round', newPop);
    if (round < weeks.length-1) {
      generateStrategies(newPop, (err, newRoundPop) => {
        battle(newRoundPop, round, callback)
      });
    } else {
      callback(err, newPop);
    }
  });
};


const start = () => {
  createRandomStrategies({
    nbPop,
    smaValues,
    stopLossValues,
    trailingStopValues,
    riskValues,
  }, (err, pop) => {
    battle(pop, 0, (errBattle, res) => {
      if (errBattle) {
        log.error(errBattle)
      }
      log.info('Finished', res);
    });
  });
};


database.connect({}, (err, res) => {
  if (err) {
    log.error(err)
  }
  start();
});

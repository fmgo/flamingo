/**
 * Created by fmgo on 04/10/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */

const mongodb = require('mongodb');
const log = require('winston');
const moment = require('moment');
const async = require('async');
const config = require('../config');
const _ = require('lodash');

let db = null;

/**
 * Connection to mongodb database
 *
 * @param {string} mongoDbUrl
 * @param cb
 */
const connect = (mongoDbUrl = config.mongoDbUrl, cb) => {
  log.info('Connect to %s', mongoDbUrl);
  mongodb.connect(mongoDbUrl, (err, _db) => {
    if (err) {
      cb(err);
    }
    log.verbose('MongoDB Connected');
    db = _db;
    cb(err, db);
  });
};

/**
 * Get Last Tick from utm or before
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {date} opt.utm
 * @param cb
 */
const getTick = (opt, cb) => {
  log.verbose('Get %s tick before or equal to %s', opt.epic, opt.utm);
  db.collection('Tick')
    .find({
      epic: opt.epic,
      utm: opt.utm,
    }, { _id: 0 })
    .sort({ utm: -1 })
    .limit(1)
    .next(cb);
};


/**
 * Get Last Quote from utm or before
 *
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {Object} opt.utm
 * @param {object} opt.resolution
 * @param {object} [opt.fields = {}]
 * @param cb
 */
const getQuote = (opt, cb) => {
  const resolution = `${opt.resolution.nbUnit}${opt.resolution.unit.toUpperCase()}`;
  log.info(opt);
  db.collection('Quote')
    .find({
      epic: opt.epic,
      utm: opt.utm,
      resolution,
      bidClose: { $ne: null },
      askClose: { $ne: null },
    }, opt.fields || { _id: 0 })
    .sort({ utm: -1 })
    .limit(1)
    .next(cb);
};


/**
 * Get All quote before utm limited to nbPoints
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {string} opt.utm
 * @param {object} opt.resolution
 * @param {number} opt.nbPoints
 * @param {object} [opt.fields={}]
 * @param cb
 */
const getQuotes = (opt, cb) => {
  const resolution = `${opt.resolution.nbUnit}${opt.resolution.unit.toUpperCase()}`;
  log.verbose('Get %d %s quote (%s) before  %s', opt.nbPoints, opt.epic, resolution, opt.utm.format());
  db.collection('Quote')
    .find({
      epic: opt.epic,
      utm: { $lt: opt.utm.utc().toDate() },
      resolution,
    }, opt.fields || {})
    .sort({ utm: -1 })
    .limit(opt.nbPoints)
    .toArray(cb);
};

/**
 * Get Prices (Bid/Ask) in Asc order (The last quote is the most recent)
 *
 * @param opt
 * @param cb
 */
const getPrices = (opt, cb) => {
  this.getQuotes(opt, (err, quotes) => {
    if (err) {
      cb(err);
    }
    quotes.reverse();
    const prices = _.map(quotes, (quote) => quote.bidClose + ((quote.askClose - quote.bidClose) / 2));
    cb(err, prices);
  });
};

/**
 * Aggregate a Quote from tick collection according to the utm and resolution
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {date} opt.utm
 * @param {object} opt.resolution
 * @param cb
 */
const aggregateQuoteFromTick = (opt, cb) => {
  const resolution = opt.resolution;
  db.collection('Tick')
    .aggregate([{
      $match: {
        epic: opt.epic,
        utm: opt.utm,
      },
    },
      {
        $project: {
          year: { $year: '$utm' },
          month: { $month: '$utm' },
          day: { $dayOfMonth: '$utm' },
          hour: { $hour: '$utm' },
          minute: { $minute: '$utm' },
          utm: 1,
          ask: 1,
          bid: 1,
        },
      },
      {
        $unwind: '$ask',
      },
      {
        $unwind: '$bid',
      },
      {
        $group: {
          _id: {
            year: '$year', month: '$month', day: '$day', hour: '$hour', minute: {
              $subtract: [
                '$minute',
                { $mod: ['$minute', resolution.nbUnit] },
              ],
            },
          },
          utm: { $first: '$utm' },
          askOpen: { $first: '$ask' },
          askHigh: { $max: '$ask' },
          askLow: { $min: '$ask' },
          askClose: { $last: '$ask' },
          bidOpen: { $first: '$bid' },
          bidHigh: { $max: '$bid' },
          bidLow: { $min: '$bid' },
          bidClose: { $last: '$bid' },
        },
      },
    ], (err, res) => {
      if (err) {
        cb(err);
      } else if (!res || !res[0]) {
        log.error('No quote aggregated', opt.utm);
        cb();
      } else {
        const quote = res[0];
        delete quote._id;
        quote.epic = opt.epic;
        quote.resolution = `${opt.resolution.nbUnit}${opt.resolution.unit.toUpperCase()}`;
        if (opt.upsert) {
          log.info('Persist quote', quote.utm);
          db.collection('Quote').updateOne({
            utm: moment(quote.utm).toDate(),
            resolution: quote.resolution,
            epic: quote.epic,
          }, quote, { upsert: true, w: 1 }, (errUpdate) => {
            cb(errUpdate, quote);
          });
        } else {
          cb(err, quote);
        }
      }
    });
};

/**
 * Aggregate a Quote from Quote collection (MINUTE) according to the utm and resolution
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {date} opt.utm
 * @param {object} opt.resolution
 * @param cb
 */
const aggregateFromMinuteQuote = (opt, cb) => {
  const resolution = opt.resolution;
  // const to = opt.utm.utc().toDate();
  // const from = opt.utm.clone().subtract(resolution.nbUnit, resolution.unit).utc()
  //   .toDate();
  db.collection('Quote')
    .aggregate([{
      $match: {
        epic: opt.epic,
        utm: opt.utm,
        resolution: '1MINUTE',
      },
    },
      {
        $project: {
          year: { $year: '$utm' },
          month: { $month: '$utm' },
          day: { $dayOfMonth: '$utm' },
          hour: { $hour: '$utm' },
          minute: { $minute: '$utm' },
          utm: 1,
          askOpen: 1,
          askHigh: 1,
          askLow: 1,
          askClose: 1,
          bidOpen: 1,
          bidHigh: 1,
          bidLow: 1,
          bidClose: 1,
        },
      },
      {
        $group: {
          _id: {
            year: '$year', month: '$month', day: '$day', hour: '$hour', minute: {
              $subtract: [
                '$minute',
                { $mod: ['$minute', resolution.nbUnit] },
              ],
            },
          },
          utm: { $first: '$utm' },
          askOpen: { $first: '$askOpen' },
          askHigh: { $max: '$askHigh' },
          askLow: { $min: '$askLow' },
          askClose: { $last: '$askClose' },
          bidOpen: { $first: '$bidOpen' },
          bidHigh: { $max: '$bidHigh' },
          bidLow: { $min: '$bidLow' },
          bidClose: { $last: '$bidClose' },
        },
      },
    ], (err, res) => {
      if (err || !res) {
        cb(err || 'No Quote aggregated');
      } else {
        async.each(res, (q, callback) => {
          const quote = q;
          delete quote._id;
          quote.epic = opt.epic;
          quote.resolution = `${opt.resolution.nbUnit}${opt.resolution.unit.toUpperCase()}`;
          if (opt.upsert) {
            log.info('Persist quote', quote);
            db.collection('Quote').updateOne({
              utm: moment(quote.utm).toDate(),
              resolution: quote.resolution,
              epic: quote.epic,
            }, quote, { upsert: true, w: 1 }, callback);
          } else {
            callback(err);
          }
        }, (errorPersist) => {
          cb(errorPersist, res);
        });
      }
      // const quote = res;
      // delete quote._id;
      // quote.epic = opt.epic;
      // quote.resolution = `${opt.resolution.nbUnit}${opt.resolution.unit.toUpperCase()}`;
      // if (opt.upsert) {
      //   log.verbose('Persist quote');
      //   db.collection('Quote').insertOne(quote);
      // }
      // cb(err, quote);
    });
};

/**
 * Build quote collection, create quote between dates with resolution passed in opt
 *
 * @param {object} opt
 * @param {string} opt.epic
 * @param {string} opt.from
 * @param {string} opt.to
 * @param {object} opt.resolution
 * @param cb
 */
const buildQuotesCollection = (opt, cb) => {
  const currentTime = moment(opt.from).seconds(0).milliseconds(0);
  let min = currentTime.get(opt.resolution.unit);
  min -= min % opt.resolution.nbUnit;
  currentTime.minute(min);
  const to = moment(opt.to).seconds(0).milliseconds(0);
  let minTo = to.get(opt.resolution.unit);
  minTo -= minTo % opt.resolution.nbUnit;
  to.minute(minTo);
  log.info('Build Quote collection', {
    epic: opt.epic,
    resolution: opt.resolution,
    from: currentTime.format(),
    to: to.format(),
  });
  async.whilst(
    () => currentTime <= to,
    (callback) => {
      const optAggregate = {
        epic: opt.epic,
        utm: {
          $gte: currentTime.clone().subtract(opt.resolution.nbUnit, opt.resolution.unit).toDate(),
          $lt: currentTime.toDate(),
        },
        resolution: opt.resolution,
        upsert: true,
      };
      aggregateQuoteFromTick(optAggregate, (err, quote) => {
        currentTime.add(opt.resolution.nbUnit, opt.resolution.unit);
        callback(err, quote);
      });
    }, cb);
};

/**
 * Upsert quotes
 *
 * @param {array} quotes
 */
const upsertQuotes = (quotes) => {
  log.verbose('Save Quotes (%d)', quotes.length);
  quotes.forEach((quote) => {
    db.collection('Quote').updateOne({
      utm: moment(quote.utm),
      resolution: quote.resolution,
      epic: quote.epic,
    }, quote, {
      upsert: true,
      w: 1,
    });
  });
};

/**
 * Clean 0 values
 * Remove all 0 values from ticks collections
 *
 * @param {object} opt
 * @param callback
 */
const clean0Value = (opt, callback) => {
  db.collection('Tick').updateMany(
    opt,
    { $pull: { bid: 0, ask: 0 } },
    { multi: true },
    callback
  );
};

const updateMarket = (market) => {
  db.collection('Market').updateOne({
    epic: market.epic,
  }, market, {
    upsert: true,
    w: 1,
  });
};

const getMarket = (opt, cb) => {
  db.collection('Market')
    .find({ epic: opt.epic }, { _id: 0 })
    .limit(1)
    .next(cb);
};

exports.connect = connect;
exports.getTick = getTick;
exports.getQuote = getQuote;
exports.getQuotes = getQuotes;
exports.getPrices = getPrices;
exports.aggregateQuoteFromTick = aggregateQuoteFromTick;
exports.aggregateFromMinuteQuote = aggregateFromMinuteQuote;
exports.buildQuotesCollection = buildQuotesCollection;
exports.upsertQuotes = upsertQuotes;
exports.clean0Value = clean0Value;
exports.updateMarket = updateMarket;
exports.getMarket = getMarket;

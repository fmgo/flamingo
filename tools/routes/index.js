/**
 * Created by fmgo on 03/12/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const express = require('express');
const router = express.Router();
const _ = require('lodash');
const mongodb = require('mongodb');

/* GET home page. */
router.get('/', (req, res) => {
  res.render('index', { title: 'Node 1' });
});

/* GET home page. */
router.get('/quotes', (req, res) => {
  const opt = {
    epic: 'CS.D.EURUSD.MINI.IP',
    resolution: '1MINUTE',
  };
  if (req.query.start && req.query.end) {
    opt.utm = { $gt: new Date(req.query.start * 1), $lt: new Date(req.query.end * 1) };
    console.log(opt.utm);
  }
  mongodb.connect('mongodb://localhost:27017/fmgo-backtest', (err, db) => {
    if (err) {
      res(err);
    }
    console.log('MongoDB Connected');
    db.collection('Quote')
      .find(opt)
      .sort({ utm: -1 })
      .toArray((errToArray, quotes) => {
        const result = _.reduce(quotes, (r, quote) => {
          const d = quote.utm.getTime();
          const open = quote.bidOpen + ((quote.askOpen - quote.bidOpen) / 2);
          const high = quote.bidHigh + ((quote.askHigh - quote.bidHigh) / 2);
          const low = quote.bidLow + ((quote.askLow - quote.bidLow) / 2);
          const close = quote.bidClose + ((quote.askClose - quote.bidClose) / 2);
          r.push([d, open, high, low, close]);
          return r;
        }, []);
        result.reverse();
        res.jsonp(result);
      });
  });
});

module.exports = router;

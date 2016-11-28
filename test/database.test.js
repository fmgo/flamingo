/**
 * Created by fmgo on 27/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const chai = require('chai');
chai.use(require('chai-datetime'));
const expect = chai.expect; // we are using the "expect" style of Chai
const moment = require('moment');
const db = require('../common/database');
const mongodbUrl = 'mongodb://localhost:27017/fmgo-backtest';


/**
 * Test database API
 *
 * TODO:
 * - Create DB init data with MOCK
 * - Add Tests for untested method
 * - Add asserts to make test useful...
 *
 */
describe('Database', () => {
  before(function(done) {
    db.connect(mongodbUrl, function(err, db) {
      if (err) {
        console.log(err);
      }
      done();
    });
  });

  describe('Get Tick', () => {

    it('Should return the last tick of the week if saturday is passed and lte = true', function(done) {
      this.timeout(10000);
      const utm = moment('2016-10-15T14:13:00.000Z'); // Saturday (No Tick)
      const lastDateTick = moment('2016-10-14T20:59:00.000Z');
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        utm: { $lte: utm.toDate() },
      };
      db.getTick(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(lastDateTick.toDate());
        done();
      });
    });

    it('Should return null if no tick is available (no lte)', function(done) {
      this.timeout(10000);
      const utm = moment('2016-10-15T14:13:00.000Z'); // Saturday (No Tick)
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        utm: utm.toDate(),
      };
      db.getTick(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(result).to.equal(null);
        done();
      });
    });
  });

  describe('Get Quote', () => {
    it('Should return the last quote of the week if saturday is passed and lte = true', (done) => {
      const utm = moment('2016-10-15T14:13:00.000Z'); // Saturday
      const lastDateQuote = moment('2016-10-14T20:58:00.000Z');
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: { $lte: utm.toDate() },
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(lastDateQuote.toDate());
        done();
      });
    });

    it('Should return the last quote of the week if saturday is passed and lt = true', (done) => {
      const utm = moment('2016-10-15T14:13:00.000Z'); // Saturday
      const lastDateQuote = moment('2016-10-14T20:58:00.000Z');
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: { $lt: utm.toDate() },
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(lastDateQuote.toDate());
        done();
      });
    });

    it('Should return null without error if no quote is available exact utm', (done) => {
      const utm = moment('2016-10-15T14:13:00.000Z'); // Saturday (No Quote)
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: utm.toDate(),
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(result).to.equal(null);
        done();
      });
    });

    it('Should return the quote with exact utm if available (lte = true)', (done) => {
      const utm = moment('2016-10-12T14:13:00.000Z'); // Saturday
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: { $lte: utm.toDate() },
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(utm.toDate());
        done();
      });
    });

    it('Should return the previous quote with of utm if available (lt = true)', (done) => {
      const utm = moment('2016-10-12T14:13:00.000Z'); // Saturday
      const previousDate = moment('2016-10-12T14:12:00.000Z'); // Saturday
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: { $lt: utm.toDate() },
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(previousDate.toDate());
        done();
      });
    });

    it('Should return the quote with exact utm if available (lte = false)', (done) => {
      const utm = moment('2016-10-12T14:13:00.000Z'); // Saturday
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: { unit: 'minute', nbUnit: 1 },
        utm: utm.toDate(),
      };
      db.getQuote(opt, (err, result) => {
        expect(err).to.equal(null);
        expect(moment(result.utm).toDate()).to.equalDate(utm.toDate());
        done();
      });
    });
  });


  describe('Get Quotes', () => {

    it.skip('getQuotes()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getQuotes(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('getPrices()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });
  });


  describe('Get', () => {
    beforeEach((done) => {
      setTimeout(() => {
        done();
      }, 5000);
    });


    it.skip('aggregateQuoteFromTick()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('aggregateFromMinuteQuote()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('buildQuotesCollection()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('upsertQuotes()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('clean0Value()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('updateMarket()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });

    it.skip('getMarket()', (done) => {
      const opt = {
        epic: 'CS.D.EURUSD.MINI.IP',
        resolution: '1MINUTE',
        nbPoints: 10,
      };
      db.getPrices(opt, (err, result) => {
        console.log(err, result);
        done();
      });
    });
  });
});
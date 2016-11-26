/**
 * Created by fmgo on 26/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const chai = require('chai');
const expect = chai.expect; // we are using the "expect" style of Chai
const signals = require('../common/signals');

describe('Signals', () => {
  describe('#smaCrossPrice()', () => {
    it('Should return null when Not Enough Prices (Simple Data)', (done) => {
      const prices = [13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal(null);
        done();
      });
    });
    it('Should return XUP when Prices Cross SMA Up (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 10, 9, 13];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal('XUP');
        done();
      });
    });
    it('Should return XDOWN when Prices Cross SMA Up (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 9];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal('XDOWN');
        done();
      });
    });
    it('Should return null when Prices stay above SMA (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal(null);
        done();
      });
    });
    it('Should return null when Prices stay below SMA (Simple Data)', (done) => {
      const prices = [20, 19, 18, 16, 16, 14, 15, 15, 13, 12, 12, 11, 10, 9];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal(null);
        done();
      });
    });
    it.skip('Should return XUP when Prices Cross SMA Up (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 10, 9, 13];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal('XUP');
        done();
      });
    });
    it.skip('Should return XDOWN when Prices Cross SMA Up (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 9];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal('XDOWN');
        done();
      });
    });
    it.skip('Should return null when Prices stay above SMA (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal(null);
        done();
      });
    });
    it.skip('Should return null when Prices stay below SMA (Real Data)', (done) => {
      const prices = [20, 19, 18, 16, 16, 14, 15, 15, 13, 12, 12, 11, 10, 9];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal(null);
        done();
      });
    });
  });

  describe('#getStopPips()', () => {
    it.skip('Should return the Limit And Stop distance from Atr', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 10, 9, 13];
      const nbPoints = 10;
      signals.smaCrossPrice(prices, nbPoints, (err, res) => {
        expect(res.signal).to.equal('XUP');
        done();
      });
    });
  });

  describe('#calcTrend()', () => {
    it('Should return null when Not Enough Prices (Simple Data)', (done) => {
      const prices = [13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal(null);
        done();
      });
    });
    it('Should return UP when Prices Cross SMA Up (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 10, 9, 13];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('UP');
        done();
      });
    });
    it('Should return DOWN when Prices Cross SMA Up (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 9];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('DOWN');
        done();
      });
    });
    it('Should return UP when Prices stay above SMA (Simple Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('UP');
        done();
      });
    });
    it('Should return DOWN when Prices stay below SMA (Simple Data)', (done) => {
      const prices = [20, 19, 18, 16, 16, 14, 15, 15, 13, 12, 12, 11, 10, 9];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('DOWN');
        done();
      });
    });
    it.skip('Should return XUP when Prices Cross SMA Up (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 10, 9, 13];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('UP');
        done();
      });
    });
    it.skip('Should return XDOWN when Prices Cross SMA Up (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 13, 9];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('DOWN');
        done();
      });
    });
    it.skip('Should return UP when Prices stay above SMA (Real Data)', (done) => {
      const prices = [10, 11, 11, 12, 12, 13, 13, 15, 15, 13, 15, 18, 19, 20];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('UP');
        done();
      });
    });
    it.skip('Should return DOWN when Prices stay below SMA (Real Data)', (done) => {
      const prices = [20, 19, 18, 16, 16, 14, 15, 15, 13, 12, 12, 11, 10, 9];
      const nbPoints = 10;
      signals.calcTrend(prices, nbPoints, (err, res) => {
        expect(res.trend).to.equal('DOWN');
        done();
      });
    });
  });

});

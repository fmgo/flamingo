/**
 * Created by fmgo on 26/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const chai = require('chai');
const expect = chai.expect; // we are using the "expect" style of Chai
const fmgoutils = require('../common/fmgoutils');
const moment = require('moment');

describe('fmgoutil', function() {
  describe('#getPipProfit(position)', function() {
    it('should return null if no items are passed in', function() {
      const result = fmgoutils.getPipProfit();
      expect(result).to.equal(null);
    });
    it('should return the pip profit for a winning Long EURUSD Position', function() {
      const position = {
        direction: 'BUY',
        epic: 'CS.D.EURUSD.MINI.IP',
        openPrice: 1.11904,
        currentPrice: 1.12004,
        size: 1,
        lotSize: 1, // From IG EURUSD Market
        contractSize: 10000, // From IG EURUSD Market
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(10);
    });
    it('should return the pip profit for a winning Short EURUSD Position', function() {
      const position = {
        direction: 'SELL',
        epic: 'CS.D.EURUSD.MINI.IP',
        openPrice: 1.12004,
        currentPrice: 1.11904,
        size: 1,
        lotSize: 1, // From IG EURUSD Market
        contractSize: 10000, // From IG EURUSD Market
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(10);
    });
    it('should return the pip profit for a winning Long USDJPY Position', function() {
      const position = {
        direction: 'BUY',
        epic: 'CS.D.EURJPY.MINI.IP',
        openPrice: 101.855,
        currentPrice: 101.955,
        size: 1,
        lotSize: 100,
        contractSize: 10000
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(10);
    });
    it('should return the pip profit for a winning Short USDJPY Position', function() {
      const position = {
        direction: 'SELL',
        epic: 'CS.D.EURJPY.MINI.IP',
        openPrice: 101.855,
        currentPrice: 101.755,
        size: 1,
        lotSize: 100,
        contractSize: 10000
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(10);
    });
    it('should return the pip profit for a loosing Long EURUSD Position', function() {
      const position = {
        direction: 'BUY',
        epic: 'CS.D.EURUSD.MINI.IP',
        openPrice: 1.12004,
        currentPrice: 1.11904,
        size: 1,
        lotSize: 1, // From IG EURUSD Market
        contractSize: 10000, // From IG EURUSD Market
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(-10);
    });
    it('should return the pip profit for a loosing Short EURUSD Position', function() {
      const position = {
        direction: 'SELL',
        epic: 'CS.D.EURUSD.MINI.IP',
        openPrice: 1.11904,
        currentPrice: 1.12004,
        size: 1,
        lotSize: 1, // From IG EURUSD Market
        contractSize: 10000, // From IG EURUSD Market
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(-10);
    });
    it('should return the pip profit for a loosing Long USDJPY Position', function() {
      const position = {
        direction: 'BUY',
        epic: 'CS.D.EURJPY.MINI.IP',
        openPrice: 101.855,
        currentPrice: 101.755,
        size: 1,
        lotSize: 100,
        contractSize: 10000
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(-10);
    });
    it('should return the pip profit for a loosing Short USDJPY Position', function() {
      const position = {
        direction: 'SELL',
        epic: 'CS.D.EURJPY.MINI.IP',
        openPrice: 101.855,
        currentPrice: 101.955,
        size: 1,
        lotSize: 100,
        contractSize: 10000
      };
      const result = fmgoutils.getPipProfit(position);
      expect(result).to.equal(-10);
    });
  });

  describe('#calcPositionSize(balance, price, risk, stop, lotSize)', function() {
    it('should return the position size for EURUSD', function() {
      const result = fmgoutils.calcPositionSize(1500, 1.11904, 0.05, 10, 1);
      expect(result).to.equal(8);
    });
    it('should return the position size for USDJPY', function() {
      const result = fmgoutils.calcPositionSize(1500, 101.855, 0.05, 10, 100);
      expect(result).to.equal(7);
    });
  });

  describe('#isPositionStopped(context) ', function() {
    it('Should return true when hours is passed', function() {
      const context = {
        position: {
          currentProfit: 12,
          currentDate: moment('2016-02-27 23:30:00').toDate(),
        },
        strategy: {
          tradingHours: {
            start: 6,
            stop: 22,
          },
        },
        limitDistance: 35,
        stopDistance: 12,
      };
      const result = fmgoutils.isPositionStopped(context);
      expect(result).to.equal(true);
    });
    it('Should return true when limitDistance is hit', function() {
      const context = {
        position: {
          currentProfit: 37,
          currentDate: moment('2016-02-27 19:30:00').toDate(),
        },
        strategy: {
          tradingHours: {
            start: 6,
            stop: 22,
          },
        },
        limitDistance: 35,
        stopDistance: 12,
      };
      const result = fmgoutils.isPositionStopped(context);
      expect(result).to.equal(true);
    });
    it('Should return true when stopDistance is hit', function() {
      const context = {
        position: {
          currentProfit: -14,
          currentDate: moment('2016-02-27 19:30:00').toDate(),
        },
        strategy: {
          tradingHours: {
            start: 6,
            stop: 22,
          },
        },
        limitDistance: 35,
        stopDistance: 12,
      };
      const result = fmgoutils.isPositionStopped(context);
      expect(result).to.equal(true);
    });
    it('Should return false when neither hour, limit or stop are hit', function() {
      const context = {
        position: {
          currentProfit: 17,
          currentDate: moment('2016-02-27 19:30:00').toDate(),
        },
        strategy: {
          tradingHours: {
            start: 6,
            stop: 22,
          },
        },
        limitDistance: 35,
        stopDistance: 12,
      };
      const result = fmgoutils.isPositionStopped(context);
      expect(result).to.equal(false);
    });
  });
});
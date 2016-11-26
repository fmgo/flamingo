/**
 * Created by fmgo on 26/11/2016.
 * Copyright(c) 2016 fmgo
 * MIT Licensed
 */
const chai = require('chai');
const expect = chai.expect; // we are using the "expect" style of Chai
const indicators = require('../common/indicators');

describe('Indicators', () => {
  describe('#calcCross()', () => {
    it('Should return a XUP if prev is below sma and current is above sma', () => {
      const data = {
        prev: { price: 5, sma: 7 },
        current: { price: 8, sma: 7 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma);
      expect(cross).to.equal('XUP');
    });
    it('Should return a XUP if prev is equal sma and current is above sma', () => {
      const data = {
        prev: { price: 4, sma: 4 },
        current: { price: 6, sma: 5 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma);
      expect(cross).to.equal('XUP');
    });
    it('Should return a XDOWN if prev is above sma and current is below sma', () => {
      const data = {
        prev: { price: 8, sma: 7 },
        current: { price: 5, sma: 7 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma);
      expect(cross).to.equal('XDOWN');
    });
    it('Should return a XDOWN if prev is equal sma and current is below sma', () => {
      const data = {
        prev: { price: 8, sma: 8 },
        current: { price: 5, sma: 7 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma);
      expect(cross).to.equal('XDOWN');
    });
    it('Should return null if prev is above sma and current is also above sma', () => {
      const data = {
        prev: { price: 8, sma: 7 },
        current: { price: 9, sma: 7 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma
      );
      expect(cross).to.equal(null);
    });
    it('Should return null if prev is below sma and current is also below sma', () => {
      const data = {
        prev: { price: 5, sma: 7 },
        current: { price: 6, sma: 7 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma
      );
      expect(cross).to.equal(null);
    });
    it('Should return null if prev is below sma and current is equal sma', () => {
      const data = {
        prev: { price: 5, sma: 7 },
        current: { price: 6, sma: 6 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma
      );
      expect(cross).to.equal(null);
    });
    it('Should return null if prev is above sma and current is equal sma', () => {
      const data = {
        prev: { price: 7, sma: 6 },
        current: { price: 6, sma: 6 },
      };
      const cross = indicators.calcCross(
        data.prev.price,
        data.prev.sma,
        data.current.price,
        data.current.sma
      );
      expect(cross).to.equal(null);
    });
  });
});

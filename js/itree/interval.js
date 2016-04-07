
/**
interval, containing start and and

@class Interval
@module interval-tree2
 */
var Interval;

Interval = (function() {

  /**
  @constructor
  @param {Number} start start of the interval
  @param {Number} end end of the interval
  @param {Number|String} id id of the interval
  @param {Object|String|Number|Null|Undefined} optional object to attach to the interval
   */
  function Interval(start, end, id, object) {
    this.start = start;
    this.end = end;
    this.id = id;
    this.object = object;
  }


  /**
  get center of the interval
  
  @method center
  @return {Number} center
   */

  Interval.prototype.center = function() {
    return (this.start + this.end) / 2;
  };

  return Interval;

})();

module.exports = Interval;

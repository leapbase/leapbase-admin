var assert = require('assert');
var fs = require('fs');
var util = require('util');
var path = require('path');
var _ = require('lodash');

describe('leapbase', function() {
  describe('admin module', function() {
    before(function() {
      var app = {};
      var appSitePath = path.resolve(process.cwd() + '/site')
      app.server = { get:function(){}, post:function(){}, all:function(){} };
      app.setting = require(path.join(appSitePath, '/setting')).setting;
      app.eventEmitter = { on:function(){}, emit:function(){} };
      adminModule = require(path.join(appSitePath, '/app_modules/admin'))(app);
    });
    it('test() should return test string', function() {
      assert.equal(
        adminModule.test(), 
        'admin test'
      );
    });
  });
});

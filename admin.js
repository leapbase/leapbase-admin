'use strict';
var debug = require('debug')('admin');
var util = require('util');
var multer = require('multer');
var jwt = require('jsonwebtoken');
var _ = require('lodash');
var tool = require('leaptool');

module.exports = function(app) {

  var module_name = 'admin';
  app.eventEmitter.emit('extension::init', module_name);
  
  var block = {
    app: app,
    role: 'admin',
    model: null
  };
  
  block.data = tool.object(require('basedata')(app, module_name));
  block.page = tool.object(require('basepage')(app, module_name, block.data));
  
  block.test = function() {
    return 'admin test';
  };

  // make sure token is valid
  block.data.checkToken = function(req, res, next) {
    if (req.session && req.session.user) {
      console.log('checkToken req.session.user:', req.session.user);
      next(); // no need for token check if user is logged in already
    } else {
      // check header or url parameters or post parameters for token
      var token = req.body.token || req.query.token || req.headers['x-access-token'];
      console.log('checkToken token:', token);
      if (token) {
        jwt.verify(token, app.setting.token_secret, function(err, value) {
          if (err) {
            debug('token verify error:', err);
            return res.json({ success: false, message: 'Invalid token' });
          } else {
            debug('api token check - decoded token value:', value);
            app.module.user.data.getByField(req, res, 'username', value.user, function(error, docs, info) {
              var user = docs && docs[0] || null;
              debug('token user found:', user);
              if (user) {
                req.session = req.session || {};
                req.session.user = user;
                // remove token from req.body or req.query
                if (req.query.token) {
                  delete req.query.token;
                }
                if (req.body.token) {
                  delete req.body.token;
                }
                next();
              } else {
                return res.json({ success: false, message: 'No user found for token' });
              }
            })
          }
        });
      } else {
        // if there is no token, return 403
        return res.status(403).send({
            success: false,
            message: 'No token provided'
        });
      }
    }
  };

  // make sure logged in user has access to route
  block.data.checkAccess = function(req, res, next) {
    var user = req.session && req.session.user || null;
    if (user) {
      var module_name = tool.getModuleFromUrl(req.url);
      var module_in_url = module_name && app.module[module_name];
      var module_role_name = module_in_url && module_in_url.role || '';
      debug('req url info:', req.url);
      debug('module_name:', module_name, ', module role:', module_role_name);
      debug('user info:', user.username, ', roles:', user.roles);
      if (user.roles.indexOf(module_role_name) >= 0) {
        next(); // user's roles include url's corresponding module role name
      } else {
        return res.status(403).send({
            success: false,
            message: 'User access is denied'
        });
      }
    } else {
      return res.status(403).send({
          success: false,
          message: 'No user info found'
      });
    }
  };

  block.data.viewModuleItem = function(req, res, next) {
    var callback = arguments[3] || null;
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    module.data.getById(req, res, parameter.id, callback);
  };

  block.data.deleteItems = function(req, res, next) {
    var callback = arguments[3] || null;
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    debug('admin delete items:', parameter);
    // one item delete: parameter is id
    // multiple items delete: parameter is ids
    module.data.delete(req, res, parameter, function(error, docs, info) {
      debug('admin delete result:', error, docs, info);
      app.cb(error, docs, info, req, res, callback);
    });
  };

  block.data.deleteModuleItem = function(req, res, next) {
    var callback = arguments[3] || null;
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    debug('admin delete item:', parameter.id);
    // one item delete: parameter is id
    // multiple items delete: parameter is ids
    module.data.delete(req, res, parameter, function(error, docs, info) {
      debug('admin delete result:', error, docs, info);
      app.cb(error, docs, info, req, res, callback);
    });
  };

  block.data.createModuleItem = function(req, res, next) {
    var callback = arguments[3] || null;
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    debug('admin create item for module:', moduleName);
    module.data.add(req, res, parameter, function(error, docs, info) {
      debug('admin create result:', error, docs, info);
      app.cb(error, docs, info, req, res, callback);
    });
  };

  block.data.editModuleItem = function(req, res, next) {
    var callback = arguments[3] || null;
    var parameter = tool.getReqParameter(req);
    var id = parameter._id || parameter.id;
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    debug('admin edit item for module:', moduleName, id);
    module.data.edit(req, res, parameter, function(error, docs, info) {
      debug('admin edit result:', error, docs, info);
      app.cb(error, docs, info, req, res, callback);
    });
  };


  // site admin page
  block.page.getAdminPage = function(req, res) {
    var page = app.getPage(req, { title:'admin' });
    page.systemModules = [];
    page.appModules = [];
    for (var moduleNmae in app.module) {
      var appModule = app.module[moduleNmae];
      if (appModule.role == 'admin' && appModule.model) {
        page.systemModules.push(moduleNmae);
      }
      if (appModule.role == 'user' && appModule.model) {
        page.appModules.push(moduleNmae);
      }
    }
    page.systemModules = page.systemModules.sort();
    page.appModules = page.appModules.sort();
    res.render('admin/index', { page:page });
  };

  block.page.getModule = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var page = app.getPage(req, { title:'admin' });
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    page.moduleName = moduleName;
    page.moduleModel = module.model;
    page.moduleOption = module.option;
    res.render('admin/module_list', { page:page });
  };

  block.page.addModule = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var page = app.getPage(req, { title:'add module' });
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    page.moduleName = moduleName;
    page.moduleModel = module.model;
    page.moduleOption = module.option;
    page.webEngine = app.engine;
    res.render('admin/module_add', { page:page });
  };

  block.page.getModuleItemList = function(req, res) {
    debug('in getModuleItemList');
    var parameter = tool.getReqParameter(req);
    debug('parameter:', parameter);
    var module = app.module[parameter.module_name];
    var condition = {};
    condition = _.isEmpty(condition) ? null : condition;
    block.page.getItemListPage(req, res, condition);
  };

  block.page.viewModuleItem = function(req, res) {
    debug('in viewModuleItem');
    block.page.getItemViewPage(req, res);
  };

  block.page.editModuleItem = function(req, res) {
    debug('in editModuleItem');
    block.page.getItemEditPage(req, res);
  };

  block.page.editModuleItemPost = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    debug('in editModuleItemPost');
    block.data.editModuleItem(req, res, null, function(error, docs, info) {
      var doc = docs && docs[0] || null;
      if (doc) {
        tool.setReqParameter(req, {
          id: doc._id,
          module_name: moduleName,
          app_message: {
            type: 'info',
            content: `${ moduleName } ${ doc._id } is saved`
          }
        });
        block.page.viewModuleItem(req, res);
      } else {
        app.renderInfoPage(error, null, { message:'document is not found' }, req, res);
      }
    });
  };

  block.page.createModuleItem = function(req, res) {
    debug('in createModuleItem');
    block.page.getItemCreatePage(req, res);
  };

  block.page.createModuleItemPost = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var moduleName = parameter['module_name'];
    debug('in createModuleItemPost');
    block.data.createModuleItem(req, res, null, function(error, docs, info) {
      var doc = docs && docs[0] || null;
      if (doc) {
        tool.setReqParameter(req, {
          id: doc._id,
          module_name: moduleName,
          app_message: {
            type: 'info',
            content: `${ moduleName } ${ doc._id } is created`
          }
        });
        block.page.viewModuleItem(req, res);
      } else {
        app.renderInfoPage(error, null, { message:'document is not found' }, req, res);
      }
    });
  };

  block.page.searchModuleItemPost = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var searchTerm = parameter.term || '';
    var moduleName = parameter['module_name'];
    var module = app.module[moduleName];
    var moduleData = module.data;
    debug('in searchModuleItemPost search_fields:', module.option.search_fields);
    debug('in searchModuleItemPost searchTerm:', searchTerm);
    // search with regular express for fields in search_fields
    var condition = tool.getDatabaseSearchCondition(module, searchTerm);
    var filter = tool.getQueryFilter(parameter);
    block.page.getItemListPage(req, res, condition, filter);
  };

  block.page.getDyanmicModulePage = function(req, res) {
    var parameter = tool.getReqParameter(req);
    var page = app.getPage(req, { title:'Dynamics Module' });
    res.render('admin/dynamic_module', { page:page });
  };

  // upload support using multer
  var storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'site/public/upload/')
    },
    filename: function (req, file, cb) {
      console.log('file:', file);
      cb(null, 'module-' + file.fieldname + '-' + Date.now())
    }
  })
  var upload = multer({ storage: storage })
  var processFormData = upload.fields([
    { name:'media', maxCount:1 },
    { name:'file', maxCount:1 },
    { name:'files', maxCount:10 },
    { name:'photo', maxCount:1 },
    { name:'images', maxCount:10 }
  ]);

  // data
  app.server.all('/data/admin', block.page.checkAdminLogin);
  app.server.all('/data/admin/*', block.page.checkAdminLogin);
  app.server.get('/data/admin/module/:module_name/:id/view', block.data.viewModuleItem);
  app.server.post('/data/admin/:module_name/delete', block.data.deleteItems);
  app.server.post('/data/admin/module/:module_name/:id/delete', block.data.deleteModuleItem);
  app.server.post('/data/admin/module/:module_name/delete', block.data.deleteModuleItem);
  app.server.post('/data/admin/module/:module_name/create', processFormData, block.data.createModuleItem);
  app.server.post('/data/admin/module/:module_name/edit', processFormData, block.data.editModuleItem);
  // page
  app.server.all('/admin', block.page.checkAdminLogin);
  app.server.all('/admin/*', block.page.checkAdminLogin);
  app.server.get('/admin', block.page.getAdminPage);
  app.server.get('/admin/module/:module_name', block.page.getModule);
  app.server.get('/admin/module/:module_name/add', block.page.addModule);
  app.server.get('/admin/module/:module_name/list', block.page.getModuleItemList);
  app.server.get('/admin/module/:module_name/:id/view', block.page.viewModuleItem);
  app.server.get('/admin/module/:module_name/:id/edit', block.page.editModuleItem);
  app.server.get('/admin/module/:module_name/edit', block.page.editModuleItem);
  app.server.post('/admin/module/:module_name/:id/edit', processFormData, block.page.editModuleItemPost);
  app.server.get('/admin/module/:module_name/create', block.page.createModuleItem);
  app.server.post('/admin/module/:module_name/create', processFormData, block.page.createModuleItemPost);
  app.server.post('/admin/module/:module_name/list/search', block.page.searchModuleItemPost);

  return block;
};


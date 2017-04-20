const express = require('express');
const cluster = require('cluster');
//const app = express();
const numCPUs = require('os').cpus().length;
const multer  = require('multer');
const cookieParser = require('cookie-parser');
const Config = require('./conf/Config');
const fbDB = require('./lib/fbDB');

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
} else {
  const app = express();
  const db = new fbDB();
  db.init();

  // used for file uploads and form field POSTS
  var uploadConfig = {dest: Config.UPLOAD_DIR, limits:{fileSize: Config.UPLOAD_FILE_SIZE_LIMIT}};
  var uploadMiddleware = multer( uploadConfig );
  
  // cookie handler
  app.use(cookieParser());

  // ROUTES FOR OUR API
  var router = express.Router();

  var validator = function (req, res, next) {
    res.locals.user = { validated:false, id:'guest', username:'Guest'};
    // look for a cookie named 'token'
    var token = (req.cookies ? req.cookies.token : false);
    if(token){
      res.locals.token = token;
      db.validateUserToken(req, res, function(){ next(); } );
    }else{
      next();
    }
  };
  router.use(validator);

  router.use(function(req, res, next) {
    // log each request to the console
    console.log('Route:',req.method, req.url);
    next(); 
  });

  /////////////
  // USER/AUTH ACTIONS
  router.post('/u/login', uploadMiddleware.none(), function(req, res){
    db.login(req, res);
  });
  router.get('/u/logout', function(req, res){
    db.logout(req, res);
  });
  router.post('/u/restoreUser', uploadMiddleware.none(), function(req, res){
    db.restoreUserInit(req, res);
  });
  router.post('/u/edit', uploadMiddleware.none(), function(req, res){
    db.editUserInit(req, res);
  });
  router.post('/u/editPassword', uploadMiddleware.none(), function(req, res){
    db.editPasswordInit(req, res);
  });
  router.post('/u/new', uploadMiddleware.none(), function(req, res){
    db.newUser(req, res);
  });
  router.post('/u/reset', uploadMiddleware.none(), function(req, res){
    db.reset(req, res);
  });
  router.post('/u/resetPassword', uploadMiddleware.none(), function(req, res){
    db.resetPassword(req, res);
  });

  ///////////////
  // DATA SOURCE STUFF
  // IF YOU HVE NEW SOURCES ADD THEM TO CONFIG FILE AS 'SOURCES'
  function sourceValid(source){
    if( Config.SOURCES.find( function(sourceName){ return (sourceName === source); }) !== undefined ){
      return true;
    }
    return false;
  }
  var sourceHandler = function (req, res, next, source) {
    if( ! sourceValid(source) ){
      var result = {records:[], status:'fail', error:true, detail:'Source ' + source + ' not found'};
      console.log('Error source (' + source + ') not found');
      return res.json(result);
    }
    req.params.source = req.params.source.toLowerCase();
    next();
  };
  
  router.param('source', sourceHandler);
  
  var listAll = function(req, res) {
    db.getAll(req, res);
  };
  
  // get all records
  router.get('/s/:source', listAll);
  
  // search records
  router.get('/s/:source/s/:searchText', listAll);
  
  // UPLOAD FILE
  router.post('/s/:source/u/(:id)?', uploadMiddleware.array('photo',10), function (req, res, next) {
    db.uploadInit(req, res);
  });
  
  // edit record
  router.post('/s/:source/e/:id', uploadMiddleware.none(), function (req, res) {
    db.edit(req, res);
  });
  
  // new record
  router.post('/s/:source/n/', uploadMiddleware.none(), function (req, res) {
    db.newRec(req, res);
  });
  
  // delete record
  router.get('/s/:source/d/:id', function (req, res) {
    db.deleteRec(req, res);
  });
  
  // get first
  router.get('/s/:source/first', function (req, res) {
    db.getFirst(req, res);
  });
  
  // get one rec
  router.get('/s/:source/:id', function (req, res) {
    db.getOne(req, res);
  });
  
  
  // REGISTER THE ROUTES
  // all of our routes will be prefixed with /api
  app.use('/api', router);
  
  // START THE SERVER
  app.listen(Config.APP_PORT);

  console.log(`Worker ${process.pid} started`);
}

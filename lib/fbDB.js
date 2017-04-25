var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var ObjectID = require('mongodb').ObjectID;
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');

var S3Upload = require('../conf/S3Config');
var Config = require('../conf/Config');
var fbModels = require('./fbModels');
mongoose.Promise = global.Promise;

function fbDB(p){
  return {
    url: Config.DB_URL,
    mongoPort: Config.DB_PORT,
    connection: false,
    connected: false,
    User: fbModels.user,
    Photo: fbModels.photo,
    limit: 10,
    photoLimit: 20,
    commentLimit: 20,
    db:false,
    status: 'None',
    userOpts: { path: 'user_id', select: 'username', model: fbModels.user },
    jwtOptions: {algorithm: 'HS256', issuer:'datafree', expiresIn:'200d'},
    cookieOptions: { maxAge: Config.COOKIE_MAX_AGE, domain: Config.COOKIE_DOMAIN, path: Config.COOKIE_PATH, httpOnly:true, secure: (Config.COOKIE_SECURE || false) },
    mongooseOptions: { 
      server: { 
	socketOptions: { 
	  keepAlive: 1000, 
	  connectTimeoutMS:3000, 
	  socketTimeoutMS:9000 } 
      }
    },
    init: function(p){
      this.connect();
    },
    handleError: function(result, res){
      console.log('ERROR: ', result.detail);
      if(res){
	res.json(result);
      }
    },
    sourceLabel: function(source){
      source = source.toLowerCase();
      source = source.charAt(0).toUpperCase() + source.slice(1);
      return source;
    },
    formatDate: function(myDate){
      myDate = new Date(myDate);
      var d = myDate.getDate();
      var m = myDate.getMonth();
      var y = myDate.getFullYear();
      return m +'/'+ d +'/'+ y;
    },
    connect: function(){
      var self = this;
      mongoose.Promise = global.Promise;
      mongoose.connect(this.url);
      this.db = mongoose.connection;
      this.db.on('error', console.error.bind(console, 'connection error:'));
      this.db.once('open', function() {});
      return this.db;
    },

    getAll: function(req, res){
      var self = this;
      var offset = parseInt(req.query.offset || 0);
      var range = parseInt(this.limit);
      if(offset && (offset !== undefined) ){
	range *= (offset + 1);
      }
      var source = req.params.source;
      var result = { limit:(this.limit || 0), offset:(offset || 0), count:0, countAll:0, status:this.status, detail:'records not returned', error:true, records:[], source:source};
      var searchText = req.params.searchText || req.query.search;
      var query = [];
      var Model = fbModels[source];
      if(Model){
	if(searchText){
	  var fields = Model.textSearchFields;
	  if(fields && fields.length){
	    var clauses = [];
	    fields.forEach( function(name){
	      var q = {};
	      q[name] = new RegExp(searchText, 'i');
	      clauses.push(q);
	    });
	    if(clauses.length > 0){
	      query = { $or: clauses};
	    }
	  }
	}
      console.log('Lim:', this.limit,' Range:',range, ' off:',offset, ' Search:',query);
	Model.count(query, function(err, countAll) {
	  result.countAll = countAll;
	  Model.find(query).lean().limit(range).exec( function(err, recs){
	    if(err){
	      result.detail = 'Find by Id failed';
	      return self.handleError(result, res);
	    }
	    if( (! recs) || (recs.length === 0) ){
	      result.error = false;
	      result.detail = 'No records found';
	      return self.handleError(result, res);
	    }
	    Model.populate(recs, self.userOpts, function(err, popRecs){
	      if(err){
		result.detail = 'populate recs failed';
		return self.handleError(result, res);
	      }
	      result.records = popRecs;
	      result.count = result.records.length;
	      result.error = false;
	      result.detail = 'records returned';
	      result.status = 'ok';
	      popRecs.forEach( function(r,i){
		r = self.processRecord({source:source, record:r});
	      });
	      var params = {records:popRecs, source:source};
	      // STEP 3
	      var finalCallback = function(params){
		res.json(result);
	      };
	      // STEP 2
	      var callLoadComments = function(params){
		self.loadAllComments(params, finalCallback);
	      };
	      // STEP 1
	      self.loadAllPhotos(params, callLoadComments);
	    });
	  });
	});
      }else{
	result.detail = 'No Model found for source:' + source;
	return self.handleError(result, res);
      }
      return true;
    },
    processRecord: function(result, i){
      var r = result.record;
      r.count = i || 1;
      r.id = r._id;
      var createDate = r.createdAt || Date.now();
      r.dateCreate = this.formatDate(createDate);
      if(r.date_user){
	r.dateUser = this.formatDate(r.date_user);    
      }
      if(result.source.match(/(user|guide)/)){
	r.userId = r._id;
	if( ! r.title){
	  r.title = r.username;
	}
	delete r.password;
      }else{
	r.username = (r.user_id ? r.user_id.username : 'none');
	r.userId = (r.user_id ? r.user_id._id : null);
      }
      if(result.source == 'fish'){
	r.title = r.name;
      }
      return r;
    },
    getOne: function(req, res){
      var self = this;
      var source = req.params.source;
      var result = {status:'Get One', detail:'Undefined Key', error:true, record:{}, source:source};
      if(req.params.id === undefined) {
	return self.handleError(result, res);
      }
      var Model = fbModels[source];
      if( ! Model){
	result.detail = 'Model not found for: '+source;
	return self.handleError(result, res);
      }
      Model.findById(req.params.id).populate(self.userOpts).lean().exec( function(err, rec){
	if(err){
	  result.detail = 'FAIL: Record ' + req.params.id + ' not found';
	  return self.handleError(result, res);
	}else if(! rec){
	  result.detail = 'Record ' + req.params.id + ' not found';
	  return self.handleError(result, res);
	}else{
	  var r = result.record = rec;
	  result.record = self.processRecord(result);
	  result.error = false;
	  result.detail = 'getOne record returned';
	  result.status = 'ok';
	  result.count = 1;
	  var callback = function(photos){
	    result.record.photos = photos;
	    res.json(result);
	  };
	  return self.loadPhotos({id:r.id, source:source}, callback );
	}
      });
      return true;
    },
    loadAllPhotos: function(p, allPromiseCB){
      var self = this;
      var promises = p.records.map(function(record, i) {
	return new Promise(function(resolve, reject) {
	  var onePromiseCB = function(result){
	    if(result.error){
	      console.log('Photo Load Error:',result.detail);
	      return reject(result.detail);
	    }else{
	      record.photos = result;
	      resolve(result);
	    }
	  };
	  self.loadPhotos({ id:record.id, source:p.source }, onePromiseCB);
	});
      });
      Promise.all(promises).then(function() { return allPromiseCB(p); }).catch('Promise Photo Load Error:', console.error);
    },
    loadAllComments: function(p, cb){
      // fill in later
      return cb(p);
    },
    loadPhotos: function(p, cb){
      // load related photos
      var self = this;
      var id = p.id;
      var source = p.source;
      // GET PHOTOS
      var Model = this.Photo;
      var result = { status:'Fetch Related', pid:id, countAll:0, detail:'fetch related photos for parent ' + source, error:true, records:[], source:source};
      if( ! Model){
	result.detail = 'Model: [' + source + '] not found';
	return self.handleError(result);
      }
      var query = { pid:id };
      Model.count(query, function(err, countAll) {
	if(err){
	  result.detail = 'get related COUNT failed:' + err;
	  return self.handleError(result);
	}else{
	  if(countAll === 0){
	    result.error = false;
	    result.detail = 'No related photos found';
	    result.count = 0;
	    return cb(result);
	  }else{
	    var range = parseInt(this.photoLimit);
	    Model.find(query).lean().limit(range).exec( function(err, recs){
	      if(err){
		result.detail = 'Find by pid failed';
		return self.handleError(result);
	      }
	      Model.populate(recs, self.userOpts, function(err, popRecs){
		if(err){
		  result.detail = 'populate recs failed';
		  return self.handleError(result);
		}
		result.records = popRecs;
		result.count = popRecs.length;
		result.records.forEach( function(photo,i){
		  self.processRecord({source:'photo', record:photo}, i+1);
		});
		result.detail = 'records returned';
		result.error = false;
		result.countAll = countAll;
		cb(result);
	      });
	    });
	  }
	}
      });
    },
    loadComments: function(p){

    },
    getFirst: function(req, res){
      var self = this;
      var source = req.params.source;
      var result = { status:'Fetch One', detail:'record not returned', error:true, record:{}, source:source};
      var Model = fbModels[source];
      if(Model){
	Model.findOne({}).populate(self.userOpts).lean().exec( function(err, rec){
	  if(err){
	    result.detail = 'findOne failed:' + err;
	    return self.handleError(result, res);
	  }else{
	    var r = result.record = rec;
	    result.record = self.processRecord(result);
	    result.error = false;
	    result.detail = 'record returned';
	    result.status = 'ok';
	    result.count = 1;
	    res.json(result);
	  }
	});
      }else{
	result.detail = 'Model: [' + source + '] not found';
	return self.handleError(result, res);
      }
      return true;
    },
    permit: function(user, rec){
      var recUserId = String(rec.user_id ? rec.user_id._id : rec.id);
      var userId = String(user.id);
      //console.log('REC:',rec);
      //console.log('USER:',user);
      //console.log('Admin:',user.admin);
      //console.log('Owner:',recUserId,' === ',userId, ' = ',(recUserId === userId) );
      if((user.admin === true) || (recUserId === userId)){
	return true;
      }
      return false;
    },
    edit: function(req, res){
      var self = this;
      var source = req.params.source;
      var result = { status:'Edit', detail:'record not edited', error:true, record:{}, source:source};
      var result = { status:'Fail', detail:'You must be logged in to edit', error:true, record:{}, source:source};
      var user = res.locals.user;
      if( ! user.validated){
	return res.json(result);
      }
      var Model = fbModels[source];
      if( ! Model){
	result.detail = 'Model: [' + source + '] not found';
	return self.handleError(result, res);
      }
      Model.findById(req.params.id).populate(self.userOpts).exec( function(err, rec){
	if(err){
	  result.detail = 'FindById failed:' + err;
	  return self.handleError(result, res);
	}else{
	  if( ! self.permit(user, rec)){
	    result.error = true;
	    result.detail = 'Not permitted to Edit this record';
	    return res.json(result);
	  }else{
	    var p = req.body;
	    for(var name in p){
	      if( ! name.match(/^(_id|id|user_id|pid)$/) ){
		rec[name] = p[name];
	      }
	    }
	    rec.save(function (err, rec2) {
	      if(err){
		result.detail = 'FAIL:' + err;
		return self.handleError(result, res);
	      }else{
		var r = result.record = rec2.toJSON();
		result.record = self.processRecord(result);
		result.error = false;
		result.detail = 'Record sucessfully modified';
		result.status = 'ok';
		result.count = 1;
		res.json(result);
	      }
	    });
	  }
	}
      });
      return true;
    },
    deleteRec: function(req, res){
      var self = this;
      var source = req.params.source;
      var result = { status:'Fail', detail:'You must be logged in to delete', error:true, record:{}, source:source};
      var user = res.locals.user;
      if( ! user.validated){
	return res.json(result);
      }
      var Model = fbModels[source];
      if( ! Model){
	result.detail = 'Model: [' + source + '] not found';
	return self.handleError(result, res);
      }
      if(Model.permitMode){
	if(Model.permitMode['delete'] === false){
	  result.detail = 'Model: [' + source + '] not permitted to DELETE';
	  return self.handleError(result, res);
	}
      }
      Model.findById(req.params.id).populate(self.userOpts).exec( function(err, rec){
	if(err){
	  result.detail = 'FindById failed:' + err;
	  self.handleError(result, res);
	}else{
	  if(rec === null){
	    result.detail = 'FAIL: Record for delete not found';
	    return self.handleError(result, res);
	  }else if( ! self.permit(user, rec)){
	    result.error = true;
	    result.detail = 'FAIL: Not permitted to Delete this record';
	    return res.json(result);
	  }else{
	    rec.remove(function (err, rec2) {
	      if(err){
		result.detail = 'Delete failed:' + err;
		return self.handleError(result, res);
	      }else{
		var r = result.record = rec2.toJSON();
		result.record = self.processRecord(result);
		result.error = false;
		result.detail = 'record deleted';
		result.status = 'ok';
		result.count = 1;
		res.json(result);
	      }
	    });
	  }
	}
      });
      return true;
    },
    newRec: function(req, res){
      var self = this;
      var source = req.params.source;
      var result = { status:'Fail', detail:'You must be logged in to post', error:true, record:{}, source:source};
      var user = res.locals.user;
      if( ! user.validated){
	return res.json(result);
      }
      var Model = fbModels[source];
      if( ! Model){
	result.detail = 'Model: [' + source + '] not found';
	return self.handleError(result, res);
      }
      if(Model.permitMode){
	if(Model.permitMode['new'] === false){
	  result.detail = 'Model: [' + source + '] not permitted to add NEW';
	  return self.handleError(result, res);
	}
      }
      var p = req.body;
      var newRec = {};
      for(var name in p){
	if( ! name.match(/^(_id|id|pid)$/) ){
	  newRec[name] = p[name];
	}
      }
      newRec.user_id = user.id;
      Model.create(newRec, function(err, rec){
	if(err){
	  result.detail = String(err).trim();
	  return self.handleError(result, res);
	}else{
	  Model.populate(rec, self.userOpts, function (err, recPop) {
	    if(err){
	      result.detail = 'Populate failed:' + err;
	      return self.handleError(result, res);			    
	    }else{
	      var r = result.record = recPop.toJSON();
	      result.record = self.processRecord(result);
	      result.error = false;
	      result.detail = 'record created';
	      result.status = 'ok';
	      result.count = 1;
	      res.json(result);
	    }
	  });
	}
      });
      return true;
    },
    
    uploadInit: function(req, res){
      // STEP 1 UPLOAD ONE
      var self = this;
      var source = req.params.source;
      var result = { status:'Upload Fail', detail:'You must be logged in to upload', error:true, record:{}, source:source};
      var vUser = res.locals.user;
      if( ! vUser.validated){
	return res.json(result);
      }
      if(req.files && (req.files.length > 0) ){
	var file = req.files[0];
	result.file = file;
	var pid = req.params.id;
	if(pid){
	  // this is a child upload for parent record. Insure that the user has permission
	  var Model = fbModels[source];
	  if( ! Model){
	    result.detail = 'Model not found for: '+source;
	    return self.handleError(result, res);
	  }
	  Model.findById(pid).populate(self.userOpts).lean().exec( function(err, rec){
	    if(err){
	      result.detail = 'FAIL: Record ' + pid + ' not found';
	      return self.handleError(result, res);
	    }else if(! rec){
	      result.detail = 'Record ' + pid + ' not found';
	      return self.handleError(result, res);
	    }else{
	      if( ! self.permit(vUser, rec)){
		result.error = true;
		result.detail = 'Not permitted to upload file to this record';
		return res.json(result);
	      }
	      return self.newPhotoDB(req, res, result);
	    }
	  });
	} else {
	  return self.newPhotoDB(req, res, result);
	}
      }else{
	result.detail = 'No Files Found for upload';
	res.json(result);
      }
    },
    
    uploadMultipleInit: function(req, res){ // NOT USED - only single upload
      // STEP 1 allows uploads multiple files
      var self = this;
      var source = req.params.source;
      var result = { status:'Upload', fileCount:(req.files.length + 1), detail:'record not found', error:true, record:{}, source:source};
      req.files.forEach( function(file){
	result.file = file;
	self.newPhotoDB(result);
      });
      result.error = false;
      result.detail = 'Processing Uploaded Files';
      res.json(result);
    },
    
    newPhotoDB: function(req, res, result){
      // STEP 2
      var self = this;
      var source = result.source;
      var Model = this.Photo;
      var f = result.file;
      var fName = f.originalname;
      var insertFields = {uploadedToS3:false, source:result.source, fEncoding:f.encoding, fMimetype:f.mimetype, fName:fName, fSize:f.size, title:req.body.title, content:req.body.content};
      insertFields.user_id = res.locals.user.id;
      if(req.params.id){
	insertFields.pid = req.params.id;
      }
      Model.create(insertFields, function(err, rec){
	if(err){
	  result.detail = 'Create photo failed:' + err;
	  return self.handleError(result, res);
	}else{
	  Model.populate(rec, self.userOpts, function (err, recPop) {
	    if(err){
	      result.detail = 'Populate failed:' + err;
	      return self.handleError(result, res);
	    }else{
	      // a single photo, has no parent
	      result.recObj = recPop;
	      result.record = recPop.toJSON();
	      result.record = self.processRecord(result);
	      result.error = false;
	      result.detail = 'Uploading Files to S3';
	      result.status = 'ok';
	      result.count = 1;
	      return self.uploadToS3(req, res, result);
	    }
	  });
	}
      });
    },

    uploadToS3: function(req, res, result){
      // STEP 3
      var self = this;
      var file = result.file;
      var fileId = result.record.id;
      var r = result.recObj;
      var source = req.params.source;
      r.s3UploadStart = Date.now();
      S3Upload.upload(file.path, {path:fileId}, function(err, s3Files, meta) {
	if (err) {
	  result.detail = 'ERROR:' + err;
	  return self.handleError(result, res);
	}else{
	  self.s3Files = s3Files;
	  s3Files.forEach(function(f) {
	    //	    console.log('S3 Upload original?', f.original, ' suffix:', f.suffix,' W:',f.width, ' H:',f.height, 'URL:',f.url);
	    if( f.original){
	      //r.url_original = f.url;
	      r.wh_original = f.width +'x'+ f.height;
	    }else if(f.suffix.match(/^_large$/)){
	      //r.url_large = f.url;
	      r.wh_large = f.width +'x'+ f.height;
	    }else if(f.suffix.match(/^_medium$/)){
	      //r.url_medium = f.url;
	      r.wh_medium = f.width +'x'+ f.height;
	    }else if(f.suffix.match(/^_small$/)){
	      //r.url_small = f.url;
	      r.wh_small = f.width +'x'+ f.height;
	    }else if(f.suffix.match(/^_thumb1$/)){
	      //r.url_thumb1 = f.url;
	      r.wh_thumb1 = f.width +'x'+ f.height;
	    }else if(f.suffix.match(/^_thumb2$/)){
	      r.wh_thumb2 = f.width +'x'+ f.height;
	      //r.url_thumb2 = f.url;
	    }
	  });
	  r.s3UploadStop = Date.now();
	  r.uploadedToS3 = true;
	  r.save(function (err, rec) {
	    if(err){
	      result.detail = 'Fail:' + err;
	      return self.handleError(result, res);
	    }else{
	      if(req.params.id && (source != 'photo')){
		//console.log('NON-PHOTO RETURN:',result);
		// a non photo source, this photo is a child
		return self.getOne(req, res);
	      }else{
		//console.log('PHOTO RETURN:',result);
		result.error = false;
		result.detail = self.s3Files.length + ' Files Uploaded';
		res.json(result);
	      }
	    }
	  });
	}
      });
    },
    verifyPassword: function(req, res, p, result){
      var self = this;
      result.error = true;
      bcrypt.compare(p.password, p.currentHash, function(err, ok) {
	if(err){
	  return self.handleError(result, res);
	}else{
	  if(ok === true){
	    result.detail = 'New Password valid';
	    result.validated = true;
	    result.status = 'ok';
	  }else{
	    // JUST FOR OLD PASSWORDS
	    // check if the password is old format
	    var pwd = Config.SALT + p.password;
	    var newHash = crypto.createHash('sha256').update(pwd).digest('hex');
	    if(newHash == p.currentHash){
	      // overrite old password with new style
	      bcrypt.hash(p.password, 10, function(err, updatedHash) {
		if(err){
		  console.log('Error creating new hash:', err);
		}else{
		  p.user.password = updatedHash;
		  p.user.save( function(err){
		    if(err){
		      console.log('Error: Updated Password not saved: ', err);
		    }else{
		      console.log('OK - Password has been updated');
		    }
		  });
		}
	      });
	      result.detail = 'Old Password valid and HAS BEEN changed';
	      result.validated = true;
	      result.status = 'ok';
	    }else{
	      // both passwords failed
	      result.detail = 'Password Invalid';
	      result.validated = false;
	      result.status = 'fail';
	    }
	  }
	  if(result.validated){
	    result.user = self.returnUser(p.user);
	    var payload = {userId: result.user.id, username:result.user.username, email:result.user.email, admin:(result.admin || false), guide: (result.guide || false)};
	    jwt.sign(payload, Config.JWT_SECRET, self.jwtOptions, function(err, token) {
	      if(err){
		result.detail = 'Token:' + err;
		return self.handleError(result, res);
	      }else{
		result.error = false;
		return res.cookie('token', token, self.cookieOptions).json(result);
	      }
	    });
	  }else{
	    result.error = false;
	    res.json(result);
	  }
	}
      });
    },
    savePassword: function(p){
      // expecting a Model User Object and input password
      var result = {status:'fail', error:true, detail:'Save Password Failed'};
    },
    returnUser: function(userObj){
      // user json to return to client
      user = userObj;
      if(typeof userObj.toJSON == 'function'){
	user = userObj.toJSON();
      }
      if(user.__v){
	delete user.__v;
      }
      delete user.password;
      user.id = user._id;
      return user;
    },
    login: function(req, res){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Login Failed'};
      var Model = self.User;
      var username = req.body.username;
      var password = req.body.password;
      if(username && password){
	var query = { $or: [ {username:username}, {email:username} ] };
	Model.findOne(query).exec( function(err, user){
	  if(err){
	    result.detail = 'Login - Find User Failed:' + err;
	    return self.handleError(result, res);
	  }else{
	    if(user){
	      p = {currentHash: user.password, password: password, user: user};
	      return self.verifyPassword(req, res, p, result );
	    }else{
	      result.detail = 'User \'' + username + '\' not found';
	      res.json(result);
	    }
	  }
	});
      }else{
	if( ! username){
	  result.detail = 'No Username found';
	}else{
	  result.detail = 'No Password found';
	}
	return self.handleError(result, res);
      }
    },
    getUser: function(req, res, cb){
      var self = this;
      var result = {validated:false, status:'ok', error:true, detail:'User restore failed'};
      var vUser = res.locals.user;
      result.user = vUser;
      var query = {username: vUser.username};
      if(vUser.validated){
	query = {_id: vUser.id};
      }
      var Model = self.User;
      Model.findOne(query, function(err, user){
	if(err){
	  result.detail = 'Restore User - Find User Failed:' + err;
	  return self.handleError(result, res);
	}else{
	  if(user){
	    result.validated = user.validated = vUser.validated;
	    result.user = user;
	    result.error = false;
	    result.detail = 'User restored';
	  }else{
	    result.detail = 'User not found';
	  }
	  cb(req, res, result);
	}
      });
    },
    newUser: function(req, res, cb){
      var result = {validated:false, status:'ok', error:true, detail:'Create User Failed'};
      var self = this;
      var p = {};
      for(var key in req.body){
	p[key] = req.body[key];
      }
      // check for required fields
      if( (! p.username) || ( ! p.email) || (! p.password) ){
	if( ! p.username){
	  result.detail = 'Username is required';
	}else if( ! p.email){
	  result.detail = 'Email is required';
	}else if( ! p.password){
	  result.detail = 'Password is required';
	}
	return res.json(result);
      }else{
	var query = { $or: [ {username:p.username}, {email:p.email} ] };
	var Model = self.User;
	Model.findOne(query, function(err, user){
	  if(err){
	    result.detail = 'Create User - Find User Failed:' + err;
	    return self.handleError(result, res);
	  }else{
	    if(user){
	      if(user.username == p.username){
		result.detail = 'Username ' + p.username + ' already exists';
	      }else if(user.email == p.email){
		result.detail = 'Email Address already exists';
	      }
	      return res.json(result);
	    }else{
	      bcrypt.hash(p.password, 10, function(err, updatedHash) {
		if(err){
		  result.detail = 'Error creating new hash:' + err;
		  return self.handleError(result, res);
		}else{
		  // new password has now been hashed, ready to save
		  p.password = updatedHash;
		  Model.create(p, function(err, newUserObj){
		    if(err){
		      result.detail = 'Create failed:' + err;
		      return self.handleError(result, res);
		    }else{
		      var payload = {userId: newUserObj._id, username:newUserObj.username, email: newUserObj.email};
		      jwt.sign(payload, Config.JWT_SECRET, self.jwtOptions, function(err, token) {
			if(err){
			  result.detail = 'New User Token Err:' + err;
			  return self.handleError(result, res);
			}else{
			  result.user = self.returnUser(newUserObj);
			  result.validated = result.user.validated = true;
			  result.error = false;
			  result.status = 'ok';
			  result.detail = 'New User Account created';
			  return res.cookie('token', token, self.cookieOptions).json(result);
			}
		      });
		    }
		  });
		}
	      });
	    }
	  }
	});
      }
    },
    restoreUserInit: function(req, res){
      var self = this;
      var cb = function(req, res, result){
	result.user = self.returnUser(result.user);
	//if(typeof result.user.toJSON == 'function'){
	//  result.user = result.user.toJSON();
	//}
	delete result.user.password;
	res.json(result);
      };
      this.getUser(req, res, cb);
    },
    editUserInit: function(req, res){
      var self = this;
      if (res.locals.user.validated){
	var cb = function(req, res, result){ self.editUser(req, res, result); };
	this.getUser(req, res, cb);
      }else{
	var result = { validated: false, status: 'fail', error: true, detail: 'User not validated' };
	return res.json(result);
      }
    },
    editUser: function(req, res, result){
      var self = this;
      result.error = true;
      var fields = req.body;
      fields.email = fields.email.trim();
      if( ( ! fields.email ) || (fields.email.length === 0) ){
	result.detail = 'Email is required';
	return res.json(result);
      }else{
	var curUser = result.user;
	var query = { _id: { $ne: curUser.id}, email:fields.email };
	var Model = self.User;
	Model.findOne(query, function(err, existingUser){
	  if(err){
	    result.detail = 'Edit User - Find User Failed:' + err;
	    return self.handleError(result, res);
	  }else if(existingUser){
	    result.detail = 'Email address '+ fields.email +' already in use';  
	    return res.json(result);
	  }else{
	    // all is ok, allow edit
	    for(var key in fields){
	      var value = fields[key];
	      value = (value === 'undefined' ? '' : value);
	      curUser[key] = value;
	    }
	    curUser.save(function (err, updatedUserObj) {
	      if(err){
		result.detail = 'Save failed:' + err;
		return self.handleError(result, res);
	      }else{
		result.user = self.returnUser(updatedUserObj);
		result.error = false;
		result.detail = 'User update ok';
		result.status = 'ok';
		res.json(result);
	      }
	    });
	  }
	});
      }
    },
    validateUserToken: function(req, res, cb){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Validate Token Failed (no token)'};
      var token = (req.cookies ? req.cookies.token : false);
      if( ! token){
	cb(req, res, result);
      }else{
	jwt.verify(token, Config.JWT_SECRET, self.jwtOptions, function(err, decoded) {
	  if(err){
	    result.detail = 'Token Validation Error:' + err;
	  }else{
	    result.detail = 'Token Validation OK';
	    result.validated = true;
	    result.error = false;
	    result.status = 'ok';
	    result.decoded = decoded;
	    var user = {id:decoded.userId, username:decoded.username, email:decoded.email, validated:true};
	    result.user = user;
	    res.locals.user = user;
	  }
	  cb(req, res, result);
	});
      }
    },
    editPasswordInit: function(req, res){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Edit Password Failed'};
      var password = req.body.password;
      result.validated = res.locals.user.validated;
      if( ! password){
	result.detail = 'Password not found';
	return self.handleError(result, res);
      }else if( ! result.validated){
	result.detail = 'user not validated';
	return self.handleError(result, res);
      }else{
	var cb = function(req, res, result){ self.editPassword(req, res, result); };
	this.getUser(req, res, cb);
      }
    },
    editPassword: function(req, res, result){
      var self = this;
      if(result.error){
	return this.handleError(result, res);
      }
      var userObj = result.user;
      var password = req.body.password;
      result.validated = res.locals.user.validated;
      result.error = true;
      bcrypt.hash(password, 10, function(err, updatedHash) {
	if(err){
	  result.detail = 'Error creating new hash:' + err;
	  return self.handleError(result, res);
	}else{
	  userObj.password = updatedHash;
	  userObj.save( function(err){
	    if(err){
	      result.detail = 'Error: Updated Password not saved:' + err;
	    }else{
	      result.user = self.returnUser(userObj);
	      result.error = false;
	      result.status = 'ok';
	      result.detail = 'Password has been updated and saved';
	    }
	    return res.json(result);
	  });
	}
      });
    },
    guestUser: function(){
      return { validated:false, id:'guest', username:'Guest'};
    },
    logout: function(req, res){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Logout Failed'};
      if(res.locals.user.validated){
	result.error = false;
	result.detail = 'User has been logged out';
	result.status = 'ok';
	result.user = this.guestUser();
	return res.clearCookie('token').json(result);
      }else{
	result.detail = 'User not validated';
	return self.handleError(result, res);
      }
    },
    reset: function(req, res){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Reset Account Failed'};
      var usernameOrEmail = req.body.username;
      if( ! usernameOrEmail){
	result.detail = 'Username OR Email is required';
	return res.json(result);
      }else{
	var Model = self.User;
	var query = { $or: [ {username:usernameOrEmail}, {email:usernameOrEmail} ] };
	Model.findOne(query, function(err, user){
	  if(err){
	    result.detail = 'Reset User - Find User Failed:' + err;
	    return self.handleError(result, res);
	  }else{
	    if(user){
	      //result.error = false;
	      result.status = 'ok';
	      var payload = {userId: user._id, username:user.username, email: user.email};
	      var options = self.jwtOptions;
	      options.expiresIn = '24h';
	      jwt.sign(payload, Config.JWT_SECRET, options, function(err, token) {
		if(err){
		  result.detail = 'Token Error:' + err;
		  return self.handleError(result, res);
		}else{
		  result.error = false;
		  var p = {user:user, token:token};
		  self.sendEmail(req, res, p);
		}
	      });
	    }else{
	      result.detail = 'No User found to match the username/password provided';	    
	      res.json(result);
	    }
	  }
	});
      }
    },
    emailBody: function(p){
      var email = p.user.email;
      var username = p.user.username;
      var anchor = 'http://localhost/spot/reset/' + p.token;
      var body = '<html><body>\n';
      body += 'Dear FishBlab User,<br />\n<br/>\nWe received a request to reset the pasword on your FishBlab Account ' + username + ' (' + email +').\n<br/>\n<br/>\n';
      body += 'Please use the link below to Reset your FishBlab password. This Reset link will expire in 24 hours.\n<br/>\n<br/>\n';
      body += '<a href="' + anchor + '">Click Here to Reset FishBlab Password</a>\n<br/>\n<br/>';
      body += 'Or cut and paste this url into your web browser:\n<br/>\n<br/>' + anchor + '\n<br/>\n<br/>';
      body += 'If you did not request this code, it is possible that someone else is trying to access the FishBlab Account ' + username +' (' + email +'). Do not forward or give this email to anyone.\n<br/>\n<br/>\n';
      body += 'You received this message because this email address is listed as the recovery email for the FishBlab Account '+ email +'. If that is incorrect, please contact support@fishblab.com to remove your email address from that FishBlab Account.\n<br/>\n<br/>\n';
      body += 'Sincerely yours,\n<br/>\n<br/>\n';
      body += 'The FishBlab Accounts team\n<br/>Email: support@fishblab.com\n';
      body += '</body></html>';
      return body;
    },
    sendEmail: function(req, res, p){
      try{
	var self = this;
	var result = {error: true, status: 'fail', detail: 'Email Failed'};
	var transporter = nodemailer.createTransport('smtps://' + Config.EMAIL +':'+ Config.EMAIL_PASSWORD +'@'+ Config.EMAIL_SMTP);
	var opts = {
	  from: Config.EMAIL_NAME + ' <' + Config.EMAIL + '>',
	  to: p.user.email + ' <' + p.user.email + '>',
	  subject: 'FishBlab Password Reset',
	  html: this.emailBody(p)
	};
	// send mail with defined transport object
	transporter.sendMail(opts, function(err, info){
	  if(err){
	    result.detail = 'Error sending mail ' + err;
            return self.handleError(result, res);
	  }else{
	    result.status = 'ok';
	    result.detail = 'Account Reset Email Sent';
	    result.msg = 'Your Account was found and an Email was sent. Please check your email to Reset your Login.';
	    result.error = false;
	    return res.json(result);
	  }
	});
      }catch(e){
	result.error = true;
	result.detail = e;
	return self.handleError(result, res);
      }
    },
    resetPassword: function(req, res){
      var self = this;
      var result = {validated:false, status:'fail', error:true, detail:'Edit Password Failed'};
      var password = req.body.password;
      var token = req.body.token;
      // user should not be validated
      result.validated = res.locals.user.validated;
      if( ! password){
	result.detail = 'Password not found';
	return self.handleError(result, res);
      }else if( ! token){
	result.detail = 'Reset Token not found';
	return self.handleError(result, res);
      }else if(result.validated){
	result.detail = 'user is validated for password reset';
	
      }else{
	jwt.verify(token, Config.JWT_SECRET, self.jwtOptions, function(err, decoded) {
	  if(err){
	    result.detail = 'Token Validation Error:' + err;
	    if( err.name.match(/TokenExpiredError/) ){
	      result.detail = 'This password reset link has expired. Please start the Reset Your Account Password process again';  
	    }
	    return self.handleError(result, res);
	  }else{
	    result.detail = 'Reset Token Validation OK';
	    result.decoded = decoded;
	    query = {_id: decoded.userId};
	    var Model = self.User;
	    Model.findOne(query, function(err, userObj){
	      if(err){
		result.detail = 'Reset Password User - Find User Failed:' + err;
		return self.handleError(result, res);
	      }else{
		if(userObj){
		  bcrypt.hash(password, 10, function(err, updatedHash) {
		    if(err){
		      result.detail = 'Error creating new hash:' + err;
		      return self.handleError(result, res);
		    }else{
		      userObj.password = updatedHash;
		      userObj.save( function(err){
			if(err){
			  result.detail = 'Error: Reset Password not saved:' + err;
			}else{
			  var payload = {userId: userObj._id, username:userObj.username, email: userObj.email};
			  jwt.sign(payload, Config.JWT_SECRET, self.jwtOptions, function(err, token) {
			    if(err){
			      result.detail = 'Token:' + err;
			      return self.handleError(result, res);
			    }else{
			      result.user = self.returnUser(userObj);
			      result.validated = result.user.validated = true;
			      result.error = false;
			      result.status = 'ok';
			      result.detail = 'Reset Password has been updated and saved';
			      return res.cookie('token', token, self.cookieOptions).json(result);
			    }
			  });
			}
		      });
		    }
		  });
		}else{
		  result.detail = 'Reset Password - User not found';
		  return self.handleError(result, res);
		}
	      }
	    });
	  }
	});
      }
    },
    close: function(){
      this.status = 'close';
      return this.status;
    }
};
}

module.exports = fbDB;

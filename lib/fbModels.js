var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var ObjectId = Schema.Types.ObjectId;
mongoose.Promise = global.Promise;

var Models = {};

function formatDate(myDate){
    var d = myDate.getDate();
    var m = myDate.getMonth();
    var y = myDate.getFullYear();
    return m +'/'+ d +'/'+ y;
}

var guideSchema = new Schema({
    username: { type: String, index: { unique: true }, required: true },
    email: { type: String, index: { unique: true } },
    password: String,
    firstname: String,
    lastname: String,
    title: { type: String, required: true, index: true },
    content: { type: String, required: true },
    options: String,
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    user_id: ObjectId,
    utype: Number,
    website: String,
    msg_disc: Boolean,
    msg_reply: Boolean,
    msg_update: Boolean,
    msg_stop: Boolean,
    photo_id: String,
    location: String,
    company: String,
    phone: String,
    active: Boolean,
    admin: { type: Boolean, default: false },
    guide: { type: Boolean, default: true, index:true },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'user'} );

var Guide = mongoose.model('guide', guideSchema);
Guide.textSearchFields = ['firstname', 'lastname', 'username', 'content'];
Guide.permitMode = {'new': false, delete: false};
Models.guide = Guide;

var userSchema = new Schema({
    username: { type: String, index: { unique: true }, required: true },
    email: { type: String, index: { unique: true } },
    password: String,
    firstname: String,
    lastname: String,
    title: String,
    content: String,
    options: String,
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    user_id: ObjectId,
    utype: Number,
    website: String,
    msg_disc: Boolean,
    msg_reply: Boolean,
    msg_update: Boolean,
    msg_stop: Boolean,
    photo_id: String,
    location: String,
    company: String,
    phone: String,
    active: Boolean,
    admin: { type: Boolean, default: false },
    guide: { type: Boolean, default: false, index:true },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'user'} );

var User = mongoose.model('user', userSchema);
User.textSearchFields = ['firstname', 'lastname', 'username', 'content'];
User.permitMode = {'new': false, delete: false};
Models.user = User;

var groupSchema = new Schema({
    title: { type: String, required: true, index: true },
    name: { type: String, index: { unique: true } },
    content: String,
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    gtype: Number,
    fish: String,
    loc: String,
    user_id: { type: ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'user_group'} );

var Group = mongoose.model('user_group', groupSchema);
Group.textSearchFields = ['title', 'name', 'content'];
Models.group = Group;


var blogSchema = new Schema({
    title: { type: String, required: true, index: true },
    content: { type: String, index:true},
    date_user: { type: Date, default: Date.now },
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    loc: String,
    user_id: { type: ObjectId, ref: 'User', index:true },
    group_id: { type: ObjectId, ref: 'User_group', index:true },
    createdAt: { type: Date, default: Date.now, index:true },
    modifiedAt: { type: Date, default: Date.now, index:true }
}, {collection:'blog'} );

var Blog = mongoose.model('blog', blogSchema);
Blog.textSearchFields = ['title', 'content'];
Models.blog = Blog;


var spotSchema = new Schema({
    title: { type: String, required: true, index: true },
    content: { type: String, required: true },
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    loc: String,
    city: String,
    state: String,
    user_id: { type: ObjectId, ref: 'User' },
    group_id: { type: ObjectId, ref: 'User_group' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'spot'} );   //, toObject: {virtuals:true}, toJSON: {virtuals:true} } );

var Spot = mongoose.model('spot', spotSchema);
Spot.textSearchFields = ['title', 'content'];
Models.spot = Spot;


var photoSchema = new Schema({
    title: { type: String, index: true },
    content: { type: String, index:true},
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    fType: Number,
    fSize: Number,
    fName: String,
    fEncoding:String,
    fMimetype:String,
    state:String,
    source: String,
    pid: ObjectId,
    url_original:{ type: String, select: true},
    wh_original:{ type: String, select: true},
    url_large:{ type: String, select: true},
    wh_large:{ type: String, select: true},
    url_medium:String,
    wh_medium:String,
    url_small:String,
    wh_small:String,
    url_thumb1:String,
    wh_thumb1:String,
    url_thumb2:String,
    wh_thumb2:String,
    uploadedToS3:{ type:Boolean, default:false },
    s3UploadStart:{ type:Date },
    s3UploadStop:{ type:Date},
    user_id: { type: ObjectId, ref: 'User' },
    group_id: { type: ObjectId, ref: 'User_group' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'file'} );

var Photo = mongoose.model('file', photoSchema);    
Photo.textSearchFields = ['title', 'content'];
Models.photo = Photo;


var discussSchema = new Schema({
    pid: ObjectId,
    title: { type: String, required: true, index: true },
    content: { type: String, required: true, index: true },
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    loc: String,
    city: String,
    state: String,
    user_id: { type: ObjectId, ref: 'User' },
    group_id: { type: ObjectId, ref: 'User_group' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'disc'} );

var Discuss = mongoose.model('disc', discussSchema);
Discuss.textSearchFields = ['title', 'content'];
Models.discuss = Discuss;

    
var reportSchema = new Schema({
    title: { type: String, required: true, index: true },
    content:   String,
    date_user: { type: Date, default: Date.now },
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    fish_id: ObjectId,
    fish_name: String,
    loc: String,
    city: String,
    state: String,
    user_id: { type: ObjectId, ref: 'User' },
    group_id: { type: ObjectId, ref: 'User_group' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'report'} );

var Report = mongoose.model('report', reportSchema);
Report.textSearchFields = ['title', 'content'];
Models.report = Report;


var fishSchema = new Schema({
    name: String,
    title: String,
    name_sci: String,
    wiki_title: String,
    wiki_auto_load: Boolean,
    content: { type: String, index:true},
    hidden: Boolean,
    lat: Number,
    lon: Number,
    avg_weight: Number,
    avg_length: Number,
    count_fish: Number,
    user_id: { type: ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'fish'} );

var Fish = mongoose.model('fish', fishSchema);
Fish.textSearchFields = ['name', 'name_sci', 'alias'];
Fish.permitMode = {'new': false, delete: false};
Models.fish = Fish;


var areaSchema =  new Schema({
    name: String,
    content: { type: String, index:true},
    hidden: Boolean,
    lat: { type: Number, index:true},
    lon: { type: Number, index:true},
    sec: {type: Number, index:true},
    city: String,
    state: String,
    user_id: { type: ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    modifiedAt: { type: Date, default: Date.now }
}, {collection:'area'} );

var Area = mongoose.model('area', areaSchema);
Area.textSearchFields = ['city', 'content'];
Models.area = Area;


module.exports = Models;

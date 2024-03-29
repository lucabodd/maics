//Configurations
const config = require('./etc/config.json');

//FS to read ldap certs
var fs = require('fs');

var createError = require('http-errors');
var https = require('https')
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var port = config.maics.port;

//logging
const log = require('log-to-file');
const app_log = config.maics.log_dir+"app.log"

var homeRouter = require('./routes/home');
var keysRouter = require('./routes/keys');
var authRouter = require('./routes/login');
var usersRouter = require('./routes/users');
var hostRouter = require('./routes/hosts');
var accessRouter = require('./routes/access');
var apiRouter = require('./routes/api');
var confinementRouter = require('./routes/confinement');
//Utility routes
var utilsIdentityRouter = require('./routes/utils/authentication');
var utilsKeysRouter = require('./routes/utils/keys');
var utilsUsersRouter = require('./routes/utils/users');
var utilsGroupsRouter = require('./routes/utils/groups');
var utilsHostsRouter = require('./routes/utils/hosts');
var utilsRolesRouter = require('./routes/utils/roles');
var utilsHostgroupsRouter = require('./routes/utils/hostgroups');
var utilsAccessRouter = require('./routes/utils/access');
var utilsConfinementRouter = require('./routes/utils/confinement');
var utilsRobotsRouter = require('./routes/utils/robots');

var session = require('express-session');

var app = express();

// view engine setup
app.set('views', [path.join(__dirname, 'views'),
                  path.join(__dirname, 'views/home/'),
                  path.join(__dirname, 'views/users/'),
                  path.join(__dirname, 'views/hosts/'),
                  path.join(__dirname, 'views/errors/'),
                  path.join(__dirname, 'views/access/'),
                  path.join(__dirname, 'views/confinement/'),
                  path.join(__dirname, 'views/keys/')]);
app.set('view engine', 'pug');

//app.use(logger(':date - :method   :url :response-time :user-agent'));
app.use(logger('dev'));
app.use(session({secret: 's3cr3tS3ss10nt3llnobod1!',resave: false, saveUninitialized:false}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), {maxAge: '21600'}));

//middleware authorization for routes
//require authentication for all except /api/

app.get(/^\/(?!api).*/, function(req,res,next){
        if (!req.session.email)
            res.render('login');
        else
            next();
});

// Routes segregation for roles
//tech and administrators
app.get('/keys/*', function(req,res,next){
    if (req.session.role == "user") {
        log("[*] Unauthorized user is trying to access host-mgmt page from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'),app_log)
        res.status(403);
        res.render('error-403');
    }
    else {
        next();
    }
});
//routes for admin
app.get('/users/*', function(req,res,next){
    if (req.session.role != "admin") {
        log("[*] Unauthorized user is trying to access host-mgmt page from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'),app_log)
        res.status(403);
        res.render('error-403');
    }
    else {
        next();
    }
});
app.get('/hosts/*', function(req,res,next){
    if (req.session.role != "admin") {
        log("[*] Unauthorized user is trying to access host-mgmt page from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'),app_log)
        res.status(403);
        res.render('error-403');
    }
    else {
        next();
    }
});
app.get('/access/*', function(req,res,next){
    if (req.session.role != "admin") {
        log("[*] Unauthorized user is trying to access host-mgmt page from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'),app_log)
        res.status(403);
        res.render('error-403');
    }
    else {
        next();
    }
});
app.get('/confinement/*', function(req,res,next){
    if (req.session.role != "admin") {
        log("[*] Unauthorized user is trying to access host-mgmt page from: "+req.ip.replace(/f/g, "").replace(/:/g, "")+" User Agent: "+req.get('User-Agent'),app_log)
        res.status(403);
        res.render('error-403');
    }
    else {
        next();
    }
});

app.use('/home/', homeRouter);
app.use('/keys/', keysRouter);
app.use('/users/', usersRouter);
app.use('/hosts/', hostRouter);
app.use('/', authRouter);
app.use('/', hostRouter);
app.use('/access/', accessRouter);
app.use('/api/', apiRouter);
app.use('/confinement/', confinementRouter);
//utility routes
app.use('/utils/', utilsUsersRouter);
app.use('/utils/', utilsIdentityRouter);
app.use('/utils/', utilsKeysRouter);
app.use('/utils/', utilsGroupsRouter);
app.use('/utils/', utilsHostsRouter);
app.use('/utils/', utilsRolesRouter);
app.use('/utils/', utilsHostgroupsRouter);
app.use('/utils/', utilsAccessRouter);
app.use('/utils/', utilsConfinementRouter);
app.use('/utils/', utilsRobotsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page based on the error code
  if(err.status == 404){
      res.status(err.status || 404);
      res.render('error-404');
  }
  //cantch generic error
  else{
      res.status(err.status || 500);
      res.render('error-500');
  }
});

https.createServer({
  key: fs.readFileSync(config.maics.SSL.KEY),
  cert: fs.readFileSync(config.maics.SSL.CERT)
}, app)
.listen(port);
console.log("[+] Server is listening on port: "+ port);

module.exports = app;

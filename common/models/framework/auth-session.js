/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */
// @jsonwebtoken is internal dependency of @passport-jwt
var jwt = require('jsonwebtoken');
const loopback = require('loopback');
const log = require('oe-logger')('auth-session');
const uuidv4 = require('uuid/v4');
var jwtUtil = require('../../../lib/jwt-token-util');

var jwtForAccessToken = process.env.JWT_FOR_ACCESS_TOKEN ? (process.env.JWT_FOR_ACCESS_TOKEN.toString() === 'true') : false;

const cachedTokens = {};
module.exports = function AuthSessionFn(AuthSession) {
  AuthSession.findForRequest = function authSessionFindForRequestFn(req, options, cb) {
    if (typeof cb === 'undefined' && typeof options === 'function') {
      cb = options;
      options = {};
    }
    var id = tokenIdForRequest(req, options);

    var proxyKey = options.model.app.get('evproxyInternalKey') || '97b62fa8-2a77-458b-87dd-ef64ff67f847';
    if (req.headers && proxyKey) {
      if (req.headers['x-evproxy-internal-key'] === proxyKey) {
        var data = req.callContext.evproxyContext.accessTokenData;
        var token = new AuthSession(data, {
          applySetters: false,
          persisted: true
        });
        return cb(null, token);
      }
    }

    if (id && id !== 'undefined') {
      // json web token contains 3 parts separated by .(dot)
      if (jwtForAccessToken && id.split('.').length === 3) {
        var jwtConfig = jwtUtil.getJWTConfig();
        var jwtOpts = {};
        jwtOpts.issuer = jwtConfig.issuer;
        jwtOpts.audience = jwtConfig.audience;
        var secretOrPrivateKey = jwtConfig.secretOrKey;
        jwt.verify(id, secretOrPrivateKey, jwtOpts, function (err, user) {
          if (err) {
            cb(err);
          } else {
            var trustedApp = user[jwtConfig.keyToVerify];
            var userObj = loopback.getModelByType('BaseUser');
            var username = '';
            if (trustedApp) {
              var rolesToAdd = [];
              var appObj = loopback.getModelByType('TrustedApp');
              var query = { appId: trustedApp };
              appObj.findOne({
                where: query
              }, req.callContext, (err, trusted) => {
                if (err) {
                  log.error(req.callContext, 'Error while Querying TrustedApp', err);
                  return cb();
                }
                if (trusted && req.headers.username && req.headers.email) {
                  username = req.headers.username;
                  var email = req.headers.email;
                  // verify supported Roles
                  if (req.headers.roles && trusted.supportedRoles) {
                    JSON.parse(req.headers.roles).forEach(function (element) {
                      if (trusted.supportedRoles.some(x => x === element)) {
                        rolesToAdd.push({ 'id': element, 'type': 'ROLE' });
                      }
                    });
                  }
                  userObj.findOne({ where: { username } }, req.callContext, (err, u) => {
                    if (err) {
                      log.error(req.callContext, 'Error Querying User Information', err);
                      return cb();
                    }
                    if (u) {
                      if (cachedTokens[username]) {
                        req.accessToken = cachedTokens[username];
                        if (rolesToAdd && rolesToAdd.length > 0) {
                          req.callContext.principals = rolesToAdd ? rolesToAdd : req.callContext.principals;
                        }
                        return cb();
                      }
                      createAccessTokenAndNext(u, req, rolesToAdd, cb);
                    } else {
                      userObj.create({ username: username, email: email, password: uuidv4() }, req.callContext, (err, newUser) => {
                        if (err) {
                          return cb();
                        }
                        if (newUser) {
                          createAccessTokenAndNext(newUser, req, rolesToAdd, cb);
                        } else {
                          cb();
                        }
                      });
                    }
                  });
                } else {
                  checkUserExistence(user, req, userObj, cb);
                }
              });
            } else {
              checkUserExistence(user, req, userObj, cb);
            }
            // Setting "id" which will be retrieved in post-auth-context-populator
            // for setting callContext.accessToken
            // user.id = id;
            // cb(null, new AuthSession(user));
          }
        });
      } else {
        this.findById(id, req.callContext, function authSessionFindById(err, token) {
          if (err) {
            cb(err);
          } else if (token) {
            token.validate(function tokenValidate(err, isValid) {
              if (err) {
                cb(err);
              } else if (isValid) {
                cb(null, token);
              } else {
                var e = new Error('Invalid Access Token');
                e.status = e.statusCode = 401;
                e.code = 'INVALID_TOKEN';
                e.retriable = false;
                cb(e);
              }
            });
          } else {
            cb();
          }
        });
      }
    } else {
      process.nextTick(function tokenForRequestFn() {
        cb();
      });
    }
  };

  function checkUserExistence(user, req, userObj, callback) {
    var username = user.username || user.email || '';
    req.accessToken = cachedTokens[username];

    if (req.accessToken) {
      return callback(null, cachedTokens[username]);
    }

    userObj.findOne({
      where: {
        username
      }
    }, req.callContext, (err, u) => {
      if (err) {
        return callback(err);
      }
      if (u) {
        if (cachedTokens[username]) {
          req.accessToken = cachedTokens[username];
          return callback(null, cachedTokens[username]);
        }
        createAccessTokenAndNext(u, req, null, callback);
      } else {
        log.error(req.callContext, 'User not found!!!');
        return callback(new Error('User not found!!'));
      }
    });
  }

  function createAccessTokenAndNext(user, req, rolesToAdd, next) {
    user.createAccessToken(user.constructor.DEFAULT_TTL, req.callContext, (err, token) => {
      if (err) {
        next(err);
      }
      if (token) {
        req.accessToken = token;
        cachedTokens[user.username] = token;
        if (rolesToAdd && rolesToAdd.length > 0) {
          req.callContext.principals = rolesToAdd ? rolesToAdd : req.callContext.principals;
        }
        next(null, token);
      } else {
        log.error(req.callContext, 'could not create access token!!!!');
        next();
      }
    });
  }

  function tokenIdForRequest(req, options) {
    var params = options.params || [];
    var headers = options.headers || [];
    var cookies = options.cookies || [];
    var i = 0;
    var length;
    var id;

    // https://github.com/strongloop/loopback/issues/1326
    if (options.searchDefaultTokenKeys !== false) {
      params = params.concat(['access_token']);
      // Adding 'x-jwt-assertion' to headers for supporting JWT Assertion.
      headers = headers.concat(['X-Access-Token', 'authorization', 'x-jwt-assertion']);
      cookies = cookies.concat(['access_token', 'authorization']);
    }

    for (length = params.length; i < length; i++) {
      var param = params[i];
      // replacement for deprecated req.param()
      id = req.params && typeof req.params[param] !== 'undefined' ? req.params[param] :
        req.body && typeof req.body[param] !== 'undefined' ? req.body[param] :
          req.query && typeof req.query[param] !== 'undefined' ? req.query[param] :
            null;
      if (id && typeof id === 'string') {
        return id;
      }
    }

    for (i = 0, length = headers.length; i < length; i++) {
      id = req.header(headers[i]);

      if (typeof id === 'string') {
        // Add support for oAuth 2.0 bearer token
        // http://tools.ietf.org/html/rfc6750
        if (id.indexOf('Bearer ') === 0) {
          id = id.substring(7);
          // Decode from base64
          var buf = new Buffer(id, 'base64');
          id = buf.toString('utf8');
        } else if (/^Basic /i.test(id)) {
          id = id.substring(6);
          id = (new Buffer(id, 'base64')).toString('utf8');
          // The spec says the string is user:pass, so if we see both parts
          // we will assume the longer of the two is the token, so we will
          // extract "a2b2c3" from:
          //   "a2b2c3"
          //   "a2b2c3:"   (curl http://a2b2c3@localhost:3000/)
          //   "token:a2b2c3" (curl http://token:a2b2c3@localhost:3000/)
          //   ":a2b2c3"
          var parts = /^([^:]*):(.*)$/.exec(id);
          if (parts) {
            id = parts[2].length > parts[1].length ? parts[2] : parts[1];
          }
        }
        return id;
      }
    }

    if (req.signedCookies) {
      for (i = 0, length = cookies.length; i < length; i++) {
        id = req.signedCookies[cookies[i]];

        if (typeof id === 'string') {
          return id;
        }
      }
    }
    return null;
  }
};

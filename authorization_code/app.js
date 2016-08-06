/**
 * This is an example of a basic node.js script that performs
 * the Authorization Code oAuth2 flow to authenticate against
 * the Spotify Accounts.
 *
 * For more information, read
 * https://developer.spotify.com/web-api/authorization-guide/#authorization_code_flow
 */

var express = require('express'); // Express web server framework
var request = require('request'); // "Request" library
var mysql = require("mysql");
var querystring = require('querystring');
var cookieParser = require('cookie-parser');
var spotifyWebApi = require('spotify-web-api-node');

var client_id = '3036ac0c826f4f5e8b4a8c1a1bc8278d'; // Your client id
var client_secret = '7ce92e60920d43f1b6a48e162422fdeb'; // Your secret
var redirect_uri = 'http://localhost:8888/callback'; // Your redirect uri

var spotifyApi = new spotifyWebApi({
  clientId : client_id,
  clientSecret : client_secret,
  redirectUri : redirect_uri
});

/**
 * Database names
 * @type {string}
 */
var db_username = "application";
var db_password = "y7F!z6C7U#EKWsI8";
var db_name = "application";
var tab_users_name = "users";

var user_id;

/**
 * Connect to database
 */
var db_connection = mysql.createConnection({
  host: "localhost",
  user: db_username,
  password: db_password
})

db_connection.connect(function(err){
  if(err){
    console.log('Error connecting to Db');
    return;
  }
  console.log('Connection established');
  db_connection.query("USE " + db_name + ";", function(err, result) {

  })
});

//db_connection.end(function(err) {
  // The connection is terminated gracefully
  // Ensures all previously enqueued queries are still
  // before sending a COM_QUIT packet to the MySQL server.
//});

/**
 * Generates a random string containing numbers and letters
 * @param  {number} length The length of the string
 * @return {string} The generated string
 */
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname + '/public'))
   .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));
});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        spotifyApi.setAccessToken(body.access_token);

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        //console.log(body);

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body.id);
          var post = {spotify_id: body.id};
          var query1 = db_connection.query("SELECT * FROM " + tab_users_name + " WHERE ?", post, function(err, result, fields) {
            if (result.length == 0) {
              console.log("create new");
              var query2 = db_connection.query('INSERT INTO ' + tab_users_name + ' SET ?', post, function (err, result) {

              });
            } else {
              console.log("user found");
            }

            //save Access Token to spotify wrapper
            user_id = body.id;

          })
        });

        console.log("done")

        // we can also pass the token to the browser to make requests from there
        res.redirect('/showPlaylist/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          })
        );
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/showPlaylist', function(req, res) {
  spotifyApi.getUserPlaylists('tiborjaner')
      .then(function(data) {
        console.log('Retrieved playlists', data.body);
      },function(err) {
        console.log('Something went wrong!', err);
      });
});


app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });
    }
  });
});


console.log('Listening on 8888');
app.listen(8888);

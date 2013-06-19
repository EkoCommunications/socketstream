// Engine.io client-side Wrapper

module.exports = function(serverStatus, message, config){

  if (Object.keys(config).length === 0) {
    config = { 
        secure  : document.location.protocol === "https:"
      , host    : document.location.hostname
      , port    : document.location.protocol === "https:" ? 443 : document.location.port
    };
  }

  return {
    connect: function(){
      var sock = new eio.Socket(config);
		var opened = false;

      sock.onopen = function() {
        var sessionId = Cookies.get('connect.sid') || Cookies.get('socket.sid');
        if (sessionId) {
          sock.send('X|' + sessionId);
        } else{
          console.warn('Unable to obtain session ID');
			 // send null session ID to tell server that it needs to generate a new one
          sock.send('X|null');
        }
		  // set opened flag
		  opened = true;
      };

		// set 3 seconds timeout for socket to open
		setTimeout(function() {
			if(!opened) {
				// close socket, will automatically emit disconnect
				sock.close();
			}
		}, 2500);
     
      sock.onmessage = function(e) {

        var i, x, msg = e.data;

        // Attempt to get the responderId from each message
        if ( (i = msg.indexOf('|')) > 0) {

          var responderId = msg.substr(0, i), 
                  content = msg.substr(i+1);

          switch (responderId) {

            // X = a system message
            case 'X':
              serverStatus.emit('ready');

				  // if it's not the standard ok response, then it must be a socket session id
				  if(content !== 'OK') {
					  var c = content.split('.');
					  Cookies.set('socket.sid', 's:' + c[0] + '.e', {expires: c[1]/1000});
				  }
              break;

            // 0 = incoming events
            // As events are so integral to SocketStream rather than breaking up the JSON message
            // sent over the event transport for efficiencies sake we append the meta data (typically 
            // the channel name) at the end of the JSON message after the final pipe | character
            case '0':
              if ( (x = content.lastIndexOf('|')) > 0) {
                var event = content.substr(0, x),
                     meta = content.substr(x+1);
                message.emit(responderId, event, meta);
              } else {
                console.error('Invalid event message received:', msg);
              }
              break;
            
            // All other messages are passed directly to the relevant Request Responder
            default:
              message.emit(responderId, content);
          }

        // EVERY message should have a responderId
        // If we can't find one, it's a malformed request
        } else {
          console.error('Invalid websocket message received:', msg);
        }

      };

      sock.onclose = function() {
        serverStatus.emit('disconnect');
      };

      // Return a function which is used to send all messages to the server
      return function(msg){
        sock.send(msg)
      };
    }
  }
}


// Private

/*
 * Cookie manipulation library
 */

var Cookies = function (key, value, options) {
    return arguments.length === 1 ?
        Cookies.get(key) : Cookies.set(key, value, options);
};

// Allows for setter injection in unit tests
Cookies._document = document;
Cookies._navigator = navigator;

Cookies.defaults = {
    path: '/'
};

Cookies.get = function (key) {
    if (Cookies._cachedDocumentCookie !== Cookies._document.cookie) {
        Cookies._renewCache();
    }

    return Cookies._cache[key];
};

Cookies.set = function (key, value, options) {
    options = Cookies._getExtendedOptions(options);
    options.expires = Cookies._getExpiresDate(value === undefined ? -1 : options.expires);

    Cookies._document.cookie = Cookies._generateCookieString(key, value, options);

    return Cookies;
};

Cookies.expire = function (key, options) {
    return Cookies.set(key, undefined, options);
};

Cookies._getExtendedOptions = function (options) {
    return {
        path: options && options.path || Cookies.defaults.path,
        domain: options && options.domain || Cookies.defaults.domain,
        expires: options && options.expires || Cookies.defaults.expires,
        secure: options && options.secure !== undefined ?  options.secure : Cookies.defaults.secure
    };
};

Cookies._isValidDate = function (date) {
    return Object.prototype.toString.call(date) === '[object Date]' && !isNaN(date.getTime());
};

Cookies._getExpiresDate = function (expires, now) {
    now = now || new Date();
    switch (typeof expires) {
        case 'number': expires = new Date(now.getTime() + expires * 1000); break;
        case 'string': expires = new Date(expires); break;
    }

    if (expires && !Cookies._isValidDate(expires)) {
        throw new Error('`expires` parameter cannot be converted to a valid Date instance');
    }

    return expires;
};

Cookies._generateCookieString = function (key, value, options) {
    key = encodeURIComponent(key);
    value = (value + '').replace(/[^!#$&-+\--:<-\[\]-~]/g, encodeURIComponent);
    options = options || {};

    var cookieString = key + '=' + value;
    cookieString += options.path ? ';path=' + options.path : '';
    cookieString += options.domain ? ';domain=' + options.domain : '';
    cookieString += options.expires ? ';expires=' + options.expires.toGMTString() : '';
    cookieString += options.secure ? ';secure' : '';

    return cookieString;
};

Cookies._getCookieObjectFromString = function (documentCookie) {
    var cookieObject = {};
    var cookiesArray = documentCookie ? documentCookie.split('; ') : [];

    for (var i = 0; i < cookiesArray.length; i++) {
        var cookieKvp = Cookies._getKeyValuePairFromCookieString(cookiesArray[i]);

        if (cookieObject[cookieKvp.key] === undefined) {
            cookieObject[cookieKvp.key] = cookieKvp.value;
        }
    }

    return cookieObject;
};

Cookies._getKeyValuePairFromCookieString = function (cookieString) {
    // "=" is a valid character in a cookie value according to RFC6265, so cannot `split('=')`
    var separatorIndex = cookieString.indexOf('=');

    // IE omits the "=" when the cookie value is an empty string
    separatorIndex = separatorIndex < 0 ? cookieString.length : separatorIndex;

    return {
        key: decodeURIComponent(cookieString.substr(0, separatorIndex)),
        value: decodeURIComponent(cookieString.substr(separatorIndex + 1))
    };
};

Cookies._renewCache = function () {
    Cookies._cache = Cookies._getCookieObjectFromString(Cookies._document.cookie);
    Cookies._cachedDocumentCookie = Cookies._document.cookie;
};

Cookies._areEnabled = function () {
    return Cookies._navigator.cookieEnabled ||
        Cookies.set('cookies.js', 1).get('cookies.js') === '1';
};

Cookies.enabled = Cookies._areEnabled();


var AbstractClientStore = require('express-brute/lib/AbstractClientStore'),
    Redis = require('redis'),
    _ = require('underscore');

var RedisStore = module.exports = function (options) {
	AbstractClientStore.apply(this, arguments);
	this.options = _.extend({}, RedisStore.defaults, options);
	this.redisOptions = _(this.options).clone();
	delete this.redisOptions.prefix;
	delete this.redisOptions.client;
	delete this.redisOptions.port;
	delete this.redisOptions.host;

	if (this.options.client) {
		this.client = this.options.client;
	} else {
		this.client = RedisStore.Redis.createClient(
			this.options.port,
			this.options.host,
			this.options.redisOptions
		);
	}
};
RedisStore.prototype = Object.create(AbstractClientStore.prototype);
RedisStore.prototype.set = function (key, value, lifetime, callback) {
	lifetime = parseInt(lifetime, 10) || 0;
	var multi    = this.client.multi(),
	    redisKey = this.options.prefix+key,
		counterKey = redisKey + ':counter';

	multi.set(redisKey, JSON.stringify(value));
	multi.incr(counterKey);
	if (lifetime > 0) {
		multi.expire(redisKey, lifetime);
		multi.expire(counterKey, lifetime + 1);
	}
	multi.exec(function (err, data) {
		typeof callback == 'function' && callback.call(this, null);
	});
};
RedisStore.prototype.get = function (key, callback) {
	var redisKey = this.options.prefix+key,
		counterKey = redisKey + ':counter';
	this.client.mGet([redisKey, counterKey], function (err, replies) {
		if (err) {
			typeof callback == 'function' && callback(err, null);
		} else {
			var data = Array.isArray(replies) ? JSON.parse(replies[0]) : null;
			if (data) {
				data.lastRequest = new Date(data.lastRequest);
				data.firstRequest = new Date(data.firstRequest);
				data.count = parseInt(replies[1], 10) || 0;
			}
			typeof callback == 'function' && callback(err, data);
		}
	});
};
RedisStore.prototype.reset = function (key, callback) {
	var redisKey = this.options.prefix + key,
		counterKey = redisKey + ':counter';
	this.client.del([redisKey, counterKey], function (err) {
		typeof callback == 'function' && callback.apply(this, arguments);
	});
};
RedisStore.Redis = Redis;
RedisStore.defaults = {
	prefix: '',
	port: 6379,
	host: '127.0.0.1'
};

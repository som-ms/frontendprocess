const { hostName, port, pwd, appInsightKey } = require("./config");
const appInsights = require("applicationinsights");
appInsights.setup(appInsightKey).start();
var client = appInsights.defaultClient;
const Redis = require("ioredis");
function MyRedis() {
  this.nodes = [
    {
      port: port,
      host: hostName,
    },
  ];

  var redis = new Redis.Cluster(this.nodes, {
    showFriendlyErrorStack: true,
    maxRetriesPerRequest: 3,
    enableAutoPipelining: true,
    connectTimeout: 20000,
    password: pwd,
    slotsRefreshTimeout: 5000,
    enableOfflineQueue: false,
    enableReadyCheck: false,
    dnsLookup: (address, callback) => callback(null, address),
    redisOptions: {
      family: 4,
      tls: {
        servername: hostName,
      },
      showFriendlyErrorStack: true,
      maxRetriesPerRequest: 3,
      enableAutoPipelining: true,
      connectTimeout: 20000,
      password: pwd,
      slotsRefreshTimeout: 5000,
      enableOfflineQueue: false,
      enableReadyCheck: false,
    },
  });

  redis.on("close", function () {
    client.trackMetric({ name: "redisSubConnClosed", value: 1.0 });
  });
  redis.on("error", (err) => {
    var propertySet = {
      errorMessage: "Something went wrong connecting redis",
      descriptiveMessage: err.message,
    };
    client.trackEvent({ name: "redisSubConnError", properties: propertySet });
  });

  return redis;
}

module.exports = MyRedis;

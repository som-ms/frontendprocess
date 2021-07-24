const io = require("socket.io")(3000, {
  pingInterval: 20000,
  pingTimeout: 20000,
});

const Redis = require("ioredis");
const Message = require("./Message");
const MyRedis = require("./MyRedis");
const ConnectMessage = require("./ConnectMessage");
const appInsights = require("applicationinsights");
const config = require("./config");

appInsights.setup(config.appInsightKey).start();
var client = appInsights.defaultClient;
let channelToSocketMap = new Map();
var socketToChannelMap = new Map();
let myRedis = new MyRedis();

myRedis.on("ready", function () {
  client.trackMetric({ name: "redisSubConnOpen", value: 1.0 });
  console.log("Redis connection Established");
});
// handle map on Onconnection & disconnection  - done
// handle Redis Subscriber connection
// subscribe to new channels on Onconnection call
// unsubscribe to channels with disconnection of OneSocketId remaining

function subscribeToChannel(channelId) {
  myRedis.subscribe(channelId, (err, count) => {
    if (err) {
      var propertySet = {
        "errorMessage": "couldn't subscribe to channel",
        "descriptiveMessage": err.message,
        "channelId": channelId
      };
      client.trackEvent({ name: "redisSubConnError", properties: propertySet });
    } else {
      var propertySet = {
        "errorMessage": "null",
        "descriptiveMessage": "subscribed to channel",
        "channelId": channelId
      };
      client.trackEvent({ name: "redisSubConn", properties: propertySet });
    }
  });
}

myRedis.on("message", (channel, message) => {
  // pass the message to all sockets associated with a channel/room
  var m = JSON.parse(message);
  console.log(
    "sending message to room: " + channel + " content:  " + m.content
  );
  sendMessageToSockets(channel, message);
});

function sendMessageToSockets(channelId, message) {
  io.to(channelId).emit("ops", message); // emits message to the room named as channelId
}

io.on("connection", (socket) => {
  console.log("client connected with socketId: " + socket.id);
  socket.on("connMessage", (data) => {
    var connectMessage = JSON.parse(data);
    updateChannelToSocketMap(
      connectMessage.socketId,
      connectMessage.channelId,
      false
    );
    socket.join(connectMessage.channelId); // join the room named after channelId
  });
  socket.on("disconnect", (reason) => {
    console.log("Disconnect reason: " + reason);
    // fetch channel info using socketId
    var channelId = socketToChannelMap.get(socket.id);
    updateSocketToChannelMap(socket.id, channelId, true);
    socket.leave(channelId); // leave the room once disconnect
  });
});

function updateSocketToChannelMap(socketId, channelId, isDeleteRequired) {
  if (isDeleteRequired) {
    socketToChannelMap.delete(socketId);
    updateChannelToSocketMap(socketId, channelId, true);
  } else {
    socketToChannelMap.set(socketId, channelId);
  }
}

function updateChannelToSocketMap(socketId, channelId, isDeleteRequired) {
  if (isDeleteRequired) {
    var currentSet = channelToSocketMap.get(channelId);
    currentSet.delete(socketId);
    if (currentSet.size == 0) {
      channelToSocketMap.delete(channelId);
      // unsubscribe to channel
    } else {
      channelToSocketMap.set(channelId, currentSet);
    }
  } else {
    updateSocketToChannelMap(socketId, channelId, false);
    if (channelToSocketMap.has(channelId)) {
      var currentSet = channelToSocketMap.get(channelId);
      currentSet.add(socketId);
      channelToSocketMap.set(channelId, currentSet);
    } else {
      var newSet = new Set();
      newSet.add(socketId);
      channelToSocketMap.set(channelId, newSet);
      subscribeToChannel(channelId); // subscribe to newly created channel
    }
  }
}

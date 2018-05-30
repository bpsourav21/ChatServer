var express = require('express');
var http = require('http')
var socketio = require('socket.io');
var mongojs = require('mongojs');
var path = require('path');
var ObjectID = mongojs.ObjectID;
var db = mongojs('mongodb://127.0.0.1:27017/chatapp')
//var db = mongojs(process.env.MONGO_URL || 'mongodb://localhost:27017/local'); 
var app = express();
var server = http.Server(app);
var websocket = socketio(server);
// server.listen(3000, () => console.log('listening on *:3000'));

// Define the port to run on
app.set('port', 3002);

app.use(express.static(path.join(__dirname, 'public')));

server.listen(app.get('port'), function () {
  var port = server.address().port;
  console.log('Magic happens on port ' + port);
});

// Mapping objects to easily map sockets and users.
var clients = {};
var users = {};

// This represents a unique chatroom.
// For this example purpose, there is only one chatroom;
var chatId = 1;

websocket.on('connection', (socket) => {
  console.log("connection is on.....");
  clients[socket.id] = socket;
  socket.on('userJoined', (userId) => onUserJoined(userId, socket));
  socket.on('message', (message) => onMessageReceived(message, socket));
  socket.on('typingOn', (typingOn) => onMessageTyping(typingOn, socket))
});

// Event listeners.
// When a user joins the chatroom.
function onUserJoined(user, socket) {
  console.log("a new user joined.....");
  console.log(user);
  console.log(".......................");
  //console.log(socket);
  try {
    // The user is null for new users.
    if (!user._id) {
      var user = db.collection('users').insert(user, (err, user) => {

        socket.emit('userJoined', user);
        users[socket.id] = user._id;
        _sendExistingMessages(socket);
      });
    } else {
      users[socket.id] = user._id;
      _sendExistingMessages(socket);
    }
  } catch (err) {
    console.err(err);
  }
}

// When a user sends a message in the chatroom.
function onMessageReceived(message, senderSocket) {
  var userId = users[senderSocket.id];
  // Safety check.
  if (!userId) return;

  _sendAndSaveMessage(message, senderSocket);
}
//when a client typing 
function onMessageTyping(typingOn, socket) {
  console.log(typingOn)
}

// Helper functions.
// Send the pre-existing messages to the user that just joined.
function _sendExistingMessages(socket) {
  var messages = db.collection('messages')
    .find({ chatId })
    .sort({ createdAt: 1 })
    .toArray((err, messages) => {
      // If there aren't any messages, then return.
      if (!messages.length) return;
      socket.emit('message', messages.reverse());
    });
}

// Save the message to the db and send all sockets but the sender.
function _sendAndSaveMessage(message, socket, fromServer) {
  console.log("-----------------sen and save messages------------")
  console.log(message)
  var messageData = {
    text: message.text,
    user: message.user,
    createdAt: new Date(message.createdAt),
    chatId: chatId
  };

  db.collection('messages').insert(messageData, (err, message) => {
    // If the message is from the server, then send to everyone.
    var emitter = fromServer ? websocket : socket.broadcast;
    emitter.emit('message', [message]);
  });
}

// Allow the server to participate in the chatroom through stdin.
var stdin = process.openStdin();
stdin.addListener('data', function (d) {
  _sendAndSaveMessage({
    text: d.toString().trim(),
    createdAt: new Date(),
    user: {
      _id: '00_robot',
      name: "robot",
      avatar: "http://0.gravatar.com/avatar/fd0668ef3674821c45cea2514b453ea1?s=300&d=mm&r=g"
    }
  }, null /* no socket */, true /* send from server */);
});

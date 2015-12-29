var http = require('http'),
    nedb = require('nedb'),
    mosca = require('mosca'),
    url  = require('url'),
    db = new nedb('mqtt.db'),
    mqtt_port = process.env.MQTT_PORT || 1883,
    http_port = process.env.HTTP_PORT || 8080;

var mqtt = new mosca.Server({
  port: mqtt_port
});

mqtt.on('clientConnected', function(client) {
  db.insert({
    topic: '/',
    action: 'connect',
    timestamp: new Date(),
    message: client.id
  });
});

mqtt.on('clientDisconnected', function(client) {
  db.insert({
    topic: '/',
    action: 'disconnect',
    timestamp: new Date(),
    message: client.id
  });
});

mqtt.on('subscribed', function(topic, client) {
  db.insert({
    topic: '/',
    action: 'subscribe',
    timestamp: new Date(),
    message: client.id + ' ' + topic
  });
});

mqtt.on('unsubscribed', function(topic, client) {
  db.insert({
    topic: '/',
    action: 'unsubscribe',
    timestamp: new Date(),
    message: client.id + ' ' + topic
  });
});

mqtt.on('published', function(packet, client) {

  if(! client) return;
  
  packet.payloadString = packet.payload.toString();
  packet.payloadLength = packet.payload.length;
  packet.payload = JSON.stringify(packet.payload);
  packet.timestamp = new Date();
  db.insert(packet);

  db.insert({
    topic: '/',
    action: 'publish',
    timestamp: new Date(),
    message: client.id + ' ' + packet.topic
  });

});

var web = http.createServer(function(req, res) {

  var topic = url.parse(req.url).pathname;

  if(topic === '/')
    loadIndex(req, res);
  else
    loadTopic(topic, req, res);

});

db.loadDatabase(function(err) {
  web.listen(http_port);
  console.log('listening on mqtt port %d and http port %d...', mqtt_port, http_port);
});

function loadIndex(req, res) {

  db.find({topic: '/'}).sort({timestamp: -1}).exec(function(err, docs) {

    if(err) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      return res.end({error: err.toString()});
    }

    res.writeHead(200, {'Content-Type': 'text/html'});

    res.write('<html><head></head><body><pre>')
    docs.forEach(function(doc) {
      res.write(doc.timestamp + '  ');
      res.write(doc.action + '   ');
      res.write(doc.message + '\n');
    });

    res.end('</pre></body></html>');

  });

}

function loadTopic(topic, req, res) {

  topic = topic.substring(1);

  db.find({topic: topic}).sort({timestamp: -1}).exec(function(err, docs) {

    if(err) {
      res.writeHead(500, {'Content-Type': 'application/json'});
      return res.end({error: err.toString()});
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify({count: docs.length, packets: docs}, null, 2));

  });

}

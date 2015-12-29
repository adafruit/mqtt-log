var http = require('http'),
    nedb = require('nedb'),
    aedes = require('aedes')(),
    url  = require('url'),
    db = new nedb('mqtt.db'),
    mqtt_port = process.env.MQTT_PORT || 1883,
    http_port = process.env.HTTP_PORT || 8080;

var mqtt = require('net').createServer(aedes.handle);

mqtt.listen(mqtt_port);

aedes.on('client', function(client) {
  db.insert({
    topic: '/',
    action: 'connect',
    timestamp: new Date(),
    message: client.id
  });
});

aedes.on('clientDisconnect', function(client) {
  db.insert({
    topic: '/',
    action: 'disconnect',
    timestamp: new Date(),
    message: client.id
  });
});

aedes.on('subscribe', function(topic, client) {
  db.insert({
    topic: '/',
    action: 'subscribe',
    timestamp: new Date(),
    message: client.id + ' ' + topic
  });
});

aedes.on('unsubscribe', function(topic, client) {
  db.insert({
    topic: '/',
    action: 'unsubscribe',
    timestamp: new Date(),
    message: client.id + ' ' + topic
  });
});

aedes.on('publish', function(packet, client) {

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

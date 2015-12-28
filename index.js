var http = require('http'),
    nedb = require('nedb'),
    mosca = require('mosca'),
    url  = require('url'),
    db = new nedb('mqtt.db');

var web = http.createServer(function(req, res) {

  var topic = url.parse(req.url).pathname.substring(1);

  db.find({ topic: topic }, function(err, docs) {

    if(err) {
      res.writeHead(404, {'Content-Type': 'application/json'});
      res.end();
    }

    res.writeHead(200, {'Content-Type': 'application/json'});
    res.end(JSON.stringify(docs, null, 2));

  });

});

var mqtt = new mosca.Server({
  port: process.env.MQTT_PORT || 1883
});

mqtt.on('published', function(packet, client) {
  db.insert(packet);
});

db.loadDatabase(function(err) {
  web.listen(process.env.HTTP_PORT || 8080);
  console.log('listening...');
});

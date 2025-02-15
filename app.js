var express = require('express'),
  reqlib = require('app-root-path').require,
  logger = require('morgan'),
  cookieParser = require('cookie-parser'),
  bodyParser = require('body-parser'),
  app = express(),
  fs = require('fs'),
  SerialPort = require('serialport'),
  jsonStore = reqlib('/lib/jsonStore.js'),
  cors = require('cors'),
  ZWaveClient = reqlib('/lib/ZwaveClient'),
  MqttClient = reqlib('/lib/MqttClient'),
  Gateway = reqlib('/lib/Gateway'),
  store = reqlib('config/store.js'),
  config = reqlib('config/app.js'),
  debug = reqlib('/lib/debug')('App'),
  history = require('connect-history-api-fallback'),
  utils = reqlib('/lib/utils.js');

var gw; //the gateway instance
let io;

debug("Application path:" + utils.getPath(true));

// view engine setup
app.set('views', utils.joinPath(false, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true, parameterLimit: 50000 }));
app.use(cookieParser());

app.use('/', express.static(utils.joinPath(false, 'dist')));

app.use(cors());

app.use(history());

function startGateway() {
  var settings = jsonStore.get(store.settings);

  var mqtt, zwave;

  if (settings.mqtt) {
    mqtt = new MqttClient(settings.mqtt);
  }

  if (settings.zwave) {
    zwave = new ZWaveClient(settings.zwave, io);
  }

  gw = new Gateway(settings.gateway, zwave, mqtt);
}

app.startSocket = function (server) {
  io = require('socket.io')(server);

  if (gw.zwave) gw.zwave.socket = io;

  io.on('connection', function (socket) {

    debug("New connection", socket.id);

    if (gw.zwave)
      socket.emit('INIT', { nodes: gw.zwave.nodes, info: gw.zwave.ozwConfig, error: gw.zwave.error, cntStatus: gw.zwave.cntStatus })

    socket.on('ZWAVE_API', async function (data) {
      debug("Zwave api call:", data.api, data.args);
      if (gw.zwave) {
        var result = await gw.zwave.callApi(data.api, ...data.args);
        result.api = data.api;
        socket.emit("API_RETURN", result);
      }
    });

    socket.on('HASS_API', async function (data) {
      switch (data.apiName) {
        case 'delete':
          gw.publishDiscovery(data.device, data.node_id, true, true)
          break;
        case 'discover':
          gw.publishDiscovery(data.device, data.node_id, false, true)
          break;
        case 'update':
          gw.zwave.updateDevice(data.device, data.node_id)
          break;
        case 'add':
          gw.zwave.addDevice(data.device, data.node_id)
          break;
        case 'store':
          await gw.zwave.storeDevices(data.devices, data.node_id)
          break;
      }
    })

    socket.on('disconnect', function () {
      debug('User disconnected', socket.id);
    });

  });

  const interceptor = function (write) {
    return function (...args) {
      io.emit("DEBUG", args[0].toString())
      write.apply(process.stdout, args);
    };
  }

  process.stdout.write = interceptor(process.stdout.write);
  process.stderr.write = interceptor(process.stderr.write);
}

// ----- APIs ------

//get settings
app.get('/api/settings', function (req, res) {
  var data = { success: true, settings: jsonStore.get(store.settings), devices: gw.zwave ? gw.zwave.devices : {}, serial_ports: [] }
  if (process.platform !== 'sunos') {
    SerialPort.list(function (err, ports) {
      if (err) {
        debug(err);
      }
      
      data.serial_ports = ports ? ports.map(p => p.comName) : []

      res.json(data);
    })
  } else res.json(data)
});

//get config
app.get('/api/exportConfig', function (req, res) {
  return res.json({ success: true, data: jsonStore.get(store.nodes), message: "Successfully exported nodes JSON configuration" })
});

//import config
app.post('/api/importConfig', async function (req, res) {
  var config = req.body.data;
  try {

    if (!gw.zwave) throw Error("Zwave client not inited")

    if (!Array.isArray(config)) throw Error("Configuration not valid")
    else {
      for (let i = 0; i < config.length; i++) {
        const e = config[i];
        if (e && (!e.hasOwnProperty('name') || !e.hasOwnProperty('loc'))) {
          throw Error("Configuration not valid")
        } else if (e) {
          await gw.zwave.callApi("setNodeName", i, e.name || "")
          await gw.zwave.callApi("setNodeLocation", i, e.loc || "")
          if (e.hassDevices)
            await gw.zwave.storeDevices(e.hassDevices, i)
        }
      }
    }

    res.json({ success: true, message: "Configuration imported successfully" });

  } catch (error) {
    debug(error.message)
    return res.json({ success: false, message: error.message });
  }
});

//update settings
app.post('/api/settings', function (req, res) {
  jsonStore.put(store.settings, req.body)
    .then(data => {
      res.json({ success: true, message: "Configuration updated successfully" });
      return gw.close();
    })
    .then(() => startGateway())
    .catch(err => {
      debug(err);
      res.json({ success: false, message: err.message })
    })
});

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  console.log("%s %s %d - Error: %s", req.method, req.url, err.status, err.message);

  // render the error page
  res.status(err.status || 500);
  res.redirect('/');
});

startGateway();

process.removeAllListeners('SIGINT');

process.on('SIGINT', function () {
  debug('Closing...');
  gw.close();
  process.exit();
});

module.exports = app;

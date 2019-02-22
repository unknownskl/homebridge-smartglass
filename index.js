var Service, Characteristic, HomebridgeAPI;
var SmartglassRest = require('./xbox-smartglass-rest-client');
var Smartglass = require('xbox-smartglass-core-node');
var Package = require('./package.json');

module.exports = function(homebridge) {

  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  HomebridgeAPI = homebridge;
  homebridge.registerAccessory("homebridge-smartglass", "Smartglass", SmartglassDevice);
}

function SmartglassDevice(log, config) {
  this.log = log;
  this.name = config.name;
  this.liveid = config.liveid;
  this.consoleip = config.consoleip;
  this.restClient = SmartglassRest(config.address, config.port);

  this.apps = {
      1: {
          name: 'TV',
          uri: 'appx:Microsoft.Xbox.LiveTV_8wekyb3d8bbwe!Microsoft.Xbox.LiveTV.Application'
      },
      2: {
          name: 'Spotify',
          uri: 'appx:SpotifyAB.SpotifyMusic-forXbox_zpdnekdrzrea0!App'
      },
      3: {
          name: 'Netflix',
          uri: 'appx:4DF9E0F8.Netflix_mcm4njqhnhss8!App'
      },
      4: {
          name: 'Youtube',
          uri: 'appx:GoogleInc.YouTube_yfg5n0ztvskxp!App'
      },
      5: {
          name: 'Airserver',
          uri: 'appx:F3F176BD.53203526D8F6C_p8qzvses5c8me!App'
      }
  }

  var platform = this;

  this.log("Registering Television Service...");
  var device_service = new Service.Television(this.name);
  device_service.setCharacteristic(Characteristic.ConfiguredName, this.name);
  device_service.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
  device_service.setCharacteristic(Characteristic.ActiveIdentifier, 1);
  device_service.getCharacteristic(Characteristic.ActiveIdentifier)
                .on('set', function(newValue, callback) {
                    platform.log("Launching app: "+platform.apps[newValue].name);
                    platform.restClient.launchApp(platform.liveid, platform.apps[newValue].uri, function(success){
                        platform.log("App launched: "+platform.apps[newValue].name);
                        callback(null);
                    });
                });

  this.log("Registering Information Service...");
  var info_service = new Service.AccessoryInformation();
  info_service.setCharacteristic(Characteristic.Manufacturer, 'Microsoft');
  info_service.setCharacteristic(Characteristic.Model, "Xbox One");
  info_service.setCharacteristic(Characteristic.SerialNumber, this.liveid);
  info_service.setCharacteristic(Characteristic.FirmwareRevision, Package.version);

  device_service.getCharacteristic(Characteristic.Active)
                .on('get', this.get_power_state.bind(this))
                .on('set', this.set_power_state.bind(this));

  this.log("Registering Volume Service...");
  var volume_service = new Service.TelevisionSpeaker(this.name + ' Volume');
  volume_service.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
                .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
  volume_service.getCharacteristic(Characteristic.VolumeSelector)
                .on('set', (state, callback) =>{
                    this.set_volume_state(state, callback);
                });
  device_service.addLinkedService(volume_service);

  this.log("Registering Key Service...");
  device_service.getCharacteristic(Characteristic.RemoteKey)
                .on('set', this.set_key_state.bind(this));

  this.service = [info_service, device_service, volume_service];

  this.log("Registering InputSource Service...");

  for(var identifier in this.apps){
    this.apps[identifier].service = new Service.InputSource(this.apps[identifier].name, this.apps[identifier].name);
    this.apps[identifier].service.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
    this.apps[identifier].service.setCharacteristic(Characteristic.ConfiguredName, this.apps[identifier].name);

    if(identifier == '1')
        this.apps[identifier].service.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.TV);
    else
        this.apps[identifier].service.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APP);

    this.apps[identifier].service.setCharacteristic(Characteristic.Identifier, identifier);

    device_service.addLinkedService(this.apps[identifier].service);

    this.service.push(this.apps[identifier].service);
  }
}

SmartglassDevice.prototype.get_power_state = function(callback)
{
    var platform = this;
    platform.log("Getting Device Power State...");

    platform.restClient.getDevice(platform.liveid, function(device){
        platform.log(device);

        if(device.success == false){
            platform.log("Device not found on xbox-smartglass-rest server");
            platform.restClient.discoverIp(platform.consoleip, function(result){
                console.log(result);
            });

            callback(null, false);

        } else if(device.connection_state != undefined && device.connection_state == 'Connected'){
            platform.log("Device is on");
            callback(null, true);
        } else {

            var discovery = {
                discovered: false,

                ping: function(){
                    this.discovered = true;
                },

                get: function(){
                    return this.discovered;
                }
            }

            Smartglass.discovery({
                ip: platform.consoleip // Your consoles ip address (Optional)
            }, function(device, address){
                platform.log("Got discovery response");
                discovery.ping();
            });

            var startTimestamp = Math.floor(Date.now() / 1000);
            var interval = setInterval(function(){
                var nowTimestamp = Math.floor(Date.now() / 1000);
                if(discovery.get() === true){
                    platform.log("Device is on, but not connected. Connecting...");
                    platform.restClient.connect(platform.liveid, function(success){
                        platform.log('Connected to console')
                    })
                    clearInterval(interval);
                    callback(null, true);
                }

                if(nowTimestamp-startTimestamp >= 2){
                    platform.log("No response for 2 sec. Device is probably off");
                    clearInterval(interval);
                    callback(null, false);
                }
            }.bind(discovery, interval), 100);
        }
    })
}

SmartglassDevice.prototype.set_power_state = function(state, callback)
{
        var platform = this;
        platform.log("Setting Device Power State...");
        if(state === 0){
            platform.restClient.powerOff(this.liveid, function(success){
                platform.log("Send power off command");
                callback();
            });
        } else {
            // this.restClient.powerOn(this.liveid, function(success){
            //     callback();
            // });
            Smartglass.power_on({
                live_id: platform.liveid, // Put your console's live id here (Required)
                tries: 4, // Number of packets too issue the boot command (Optional)
                ip: platform.consoleip // Your consoles ip address (Optional)
            }, function(result){
                platform.log("Send power on command");

                platform.restClient.connect(platform.liveid, function(success){
                    platform.log('Connecting to console')
                })
                callback();
            });
        }
}

SmartglassDevice.prototype.set_key_state = function(state, callback)
{
        var platform = this;
        platform.log("Setting key state...");
        var input_key;
        var key_type;
        switch (state)
        {
                case Characteristic.RemoteKey.ARROW_UP:
                        input_key = 'dpad_up';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_DOWN:
                        input_key = 'dpad_down';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_LEFT:
                        input_key = 'dpad_left';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_RIGHT:
                        input_key = 'dpad_right';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.SELECT:
                        input_key = 'a';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.EXIT:
                        input_key = 'nexus';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.BACK:
                        input_key = 'b';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.PLAY_PAUSE:
                        input_key = 'play_pause';
                        key_type = 'media';
                        break;
                case Characteristic.RemoteKey.INFORMATION:
                        input_key = 'x';
                        key_type = 'input';
                        break;
        }

        if(key_type == 'input'){
            this.restClient.sendInput(this.liveid, input_key, function(success){
                platform.log("Send input key:", input_key);
                callback();
            });
        } else {
            this.restClient.sendMedia(this.liveid, input_key, function(success){
                platform.log("Send media key:", input_key);
                callback();
            });
        }
}

SmartglassDevice.prototype.set_volume_state = function(state, callback)
{
        var platform = this;
        platform.log("Setting Volume State...");

        if (state == 0)
        {
            this.restClient.sendIr(this.liveid, '0/btn.vol_up', function(success){
                platform.log("Send ir command:", '0/btn.vol_up');
            });
        } else {
            this.restClient.sendIr(this.liveid, '0/btn.vol_down', function(success){
                platform.log("Send ir command:", '0/btn.vol_down');
            });
        }
        callback();
}

SmartglassDevice.prototype.getServices = function() {
  return this.service;
}

SmartglassDevice.prototype.getManufacturer = function() {
    return 'Microsoft';
}

SmartglassDevice.prototype.getModel = function() {
    return 'Xbox One';
}

SmartglassDevice.prototype.getFirmwareVersion = function() {
    var package = require('./package.json');
    return package.version;
}

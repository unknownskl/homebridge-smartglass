var Service, Characteristic, HomebridgeAPI;
var SmartglassRest = require('./xbox-smartglass-rest-client');
var Smartglass = require('xbox-smartglass-core-node');

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

  this.log("Registering Device Service...");

  var device_service = new Service.Television(this.name);
  device_service.setCharacteristic(Characteristic.ConfiguredName, this.name);
  device_service.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
  // device_service.setCharacteristic(Characteristic.Manufacturer, 'Microsoft');
  // device_service.setCharacteristic(Characteristic.Model, "Xbox One");
  // device_service.setCharacteristic(Characteristic.SerialNumber, "FD000000000000");
  device_service.getCharacteristic(Characteristic.Active)
                .on('get', this.get_power_state.bind(this))
                .on('set', this.set_power_state.bind(this));

  this.log("Registering Volume Service...");

  var volume_service = new Service.TelevisionSpeaker(this.name + ' Volume');
  volume_service.setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
                .setCharacteristic(Characteristic.VolumeControlType, Characteristic.VolumeControlType.ABSOLUTE);
  volume_service
                .getCharacteristic(Characteristic.VolumeSelector)
                .on
                (
                        'set', (state, callback) =>
                        {
                                this.set_volume_state(state, callback);
                        }
                );
  device_service.addLinkedService(volume_service);

  this.log("Registering Key Service...");

  device_service.getCharacteristic(Characteristic.RemoteKey)
                .on('set', this.set_key_state.bind(this));

  this.service = [device_service, volume_service];
}

SmartglassDevice.prototype.get_power_state = function(callback)
{
    var platform = this;
    platform.log("Getting Device Power State...");

    platform.restClient.getDevice(this.liveid, function(device){
        if(device.connection_state == 'Connected'){
            callback(null, true);
        } else {
            platform.restClient.connect(platform.liveid, function(success){
                if(success == true){
                    callback(null, true)
                } else {
                    callback(null, false)
                }
            });
        }
    })
}

SmartglassDevice.prototype.set_power_state = function(state, callback)
{
        this.log("Setting Device Power State...");
        if(state === 0){
            this.restClient.powerOff(this.liveid, function(success){
                callback();
            });
        } else {
            // this.restClient.powerOn(this.liveid, function(success){
            //     callback();
            // });
            Smartglass.power_on({
                live_id: this.liveid, // Put your console's live id here (Required)
                tries: 4, // Number of packets too issue the boot command (Optional)
                ip: this.consoleip // Your consoles ip address (Optional)
            }, function(result){
                callback();
            });
        }
}

SmartglassDevice.prototype.set_key_state = function(state, callback)
{
        this.log("Setting key state...");
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
                callback();
            });
        } else {
            this.restClient.sendMedia(this.liveid, input_key, function(success){
                callback();
            });
        }
}

SmartglassDevice.prototype.set_volume_state = function(state, callback)
{
        this.log("Setting Volume State...");
        // var volume_promise;
        // if (state == 0)
        // {
        //         volume_promise = this.device.control.volume.up();
        // }
        // else
        // {
        //         volume_promise = this.device.control.volume.down();
        // }
        callback();
}

SmartglassDevice.prototype.getServices = function() {
  return this.service;
}

var Service, Characteristic, HomebridgeAPI;
var Smartglass = require('xbox-smartglass-core-node');
var SystemInputChannel = require('xbox-smartglass-core-node/src/channels/systeminput');
var SystemMediaChannel = require('xbox-smartglass-core-node/src/channels/systemmedia');
var TvRemoteChannel = require('xbox-smartglass-core-node/src/channels/tvremote');

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
    this.sgClient = false
    this.connection_status = false
    this.active_app = ''

    this.apps = [
        {
            name: 'Game',
            uri: '',
            type: Characteristic.InputSourceType.OTHER // Puts on hidden
        },
        {
            name: 'TV',
            uri: 'Microsoft.Xbox.LiveTV_8wekyb3d8bbwe!Microsoft.Xbox.LiveTV.Application',
            type: Characteristic.InputSourceType.TV
        },
        {
            name: 'Dashboard',
            uri: 'Xbox.Dashboard_8wekyb3d8bbwe!Xbox.Dashboard.Application',
            type: Characteristic.InputSourceType.HOME_SCREEN // Puts on hidden
        },
        {
            name: 'App',
            uri: '',
            type: Characteristic.InputSourceType.OTHER // Puts on hidden
        }
    ]

    this.getAppId = function(aum_id){
        // Match on App URI
        for(var app in this.apps){
            if(aum_id == this.apps[app].uri){
                this.log('getAppId() - Match app on config list')
                return app
            }
        }

        // Match on regex
        var regex = /!(.*)(Application|App|Airserver)/gm;

        for(var app in this.apps){
            var match = this.apps[app].uri.match(regex);
            this.log(match)

            if(match != null){
                // Return app
                this.log('getAppId() - Match app on as Application')
                return 3;
            }
        }

        // Return first entry in array (Game)
        this.log('getAppId() - Match app as game as no app was defined')
        return 0
    }

    if(config.apps != undefined)
        this.apps = this.apps.concat(config.apps)

    var platform = this;

    // Start Smartglass Client
    this.sgClient = Smartglass()

    var connect_client = function(){

        if(this.sgClient._connection_status == false){
            this.sgClient = Smartglass()

            this.sgClient.connect(this.consoleip).then(function(){
                    console.log('Xbox succesfully connected!');
                    platform.connection_status = true

                    this.sgClient.addManager('system_input', SystemInputChannel())
                    this.sgClient.addManager('system_media', SystemMediaChannel())
                    this.sgClient.addManager('tv_remote', TvRemoteChannel())
                    //device_service.setCharacteristic(Characteristic.Active, true)
            }.bind(this), function(error){
                if(error != false && error.error != 'device_unavailable'){
                    console.log('Failed to connect to xbox:', error);
                }

                platform.connection_status = false
            });

            this.sgClient.on('_on_timeout', function(connect_client){
                platform.connection_status = false
                //device_service.setCharacteristic(Characteristic.Active, false)
            }.bind(this, connect_client))

            this.sgClient.on('_on_console_status', function(response, device, smartglass){
                // @TODO: Rewrite this part so it uses the Smartglass class
                if(response.packet_decoded.protected_payload.apps[0] != undefined){
                    if(this.active_app != response.packet_decoded.protected_payload.apps[0].aum_id){
                        this.active_app = response.packet_decoded.protected_payload.apps[0].aum_id

                        var activeId = this.getAppId(this.active_app)
                        platform.log('[Smartglass] Xbox switched to app: '+response.packet_decoded.protected_payload.apps[0].aum_id)

                        this.device_service.setCharacteristic(Characteristic.ActiveIdentifier, activeId);
                    }
                }
            }.bind(this));
        }
    }.bind(this)

    setInterval(connect_client, 15000)
    connect_client()
    // End Start Smartglass Client

    this.log("Registering Television Service...");
    var device_service = new Service.Television(this.name);
    device_service.setCharacteristic(Characteristic.ConfiguredName, this.name);
    device_service.setCharacteristic(Characteristic.SleepDiscoveryMode, Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
    device_service.setCharacteristic(Characteristic.ActiveIdentifier, 1);
    device_service.getCharacteristic(Characteristic.ActiveIdentifier)
                .on('set', function(newValue, callback) {
                    platform.log("Launching app: "+platform.apps[newValue].name);
                    if(platform.apps[newValue].uri != ''){
                        // platform.restClient.launchApp(platform.liveid, 'appx:'+platform.apps[newValue].uri, function(success){
                        //     platform.log("App launched: "+platform.apps[newValue].name);
                            platform.activeApp = newValue;
                            callback(null);
                        // });
                    } else {
                        callback(null);
                    }
                });
    this.device_service = device_service;

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
        // this.log(identifier);
        this.apps[identifier].service = new Service.InputSource(this.apps[identifier].name, this.apps[identifier].name);
        this.apps[identifier].service.setCharacteristic(Characteristic.IsConfigured, Characteristic.IsConfigured.CONFIGURED);
        this.apps[identifier].service.setCharacteristic(Characteristic.ConfiguredName, this.apps[identifier].name);

        if(this.apps[identifier].type != undefined)
            this.apps[identifier].service.setCharacteristic(Characteristic.InputSourceType, this.apps[identifier].type);
        else
            this.apps[identifier].service.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APP);

        if(this.apps[identifier].type != undefined && this.apps[identifier].type == true){
            this.apps[identifier].service.setCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.CurrentVisibilityState.HIDDEN);
        }

        this.apps[identifier].service.setCharacteristic(Characteristic.Identifier, identifier);

        device_service.addLinkedService(this.apps[identifier].service);

        this.service.push(this.apps[identifier].service);
    }
}

SmartglassDevice.prototype.get_power_state = function(callback)
{
    if(this.sgClient._connection_status == false){
        callback(null, false);
    } else {
        callback(null, true);
    }
}

SmartglassDevice.prototype.set_power_state = function(state, callback)
{
    // this.log("Setting Device Power State...");
    // this.log(state)
    // this.log(this.sgClient._connection_status)

    var smartglass = Smartglass()
    if(this.sgClient._connection_status == false){
        // Power on
        smartglass.powerOn({
            live_id: this.liveid, // Put your console's live id here (Required)
            tries: 10, // Number of packets too issue the boot command (Optional)
            ip: this.consoleip // Your consoles ip address (Optional)
        }).then(function(){
            // callback(null, true);

        }, function(error){
            // Failed
            console.log('Smartglass power on request failed, reason:')
            console.log(error)
        });

        callback(null, true);
    } else {
        if(state != 1){
            // Power Off
            this.sgClient.powerOff().then(function(result){
                this.sgClient._connection_status = false
                callback(null, true);

            }.bind(this), function(error){
                // Failed to turn off console
                console.log('Smartglass power off request failed, reason:')
                console.log(error)
                callback(error);
            });
        } else {
            callback(null, true);
        }
    }
}

SmartglassDevice.prototype.set_key_state = function(state, callback)
{
        var platform = this;
        // platform.log("Setting key state...");
        var input_key;
        var key_type;

        switch (state)
        {
                case Characteristic.RemoteKey.ARROW_UP:
                        input_key = 'up';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_DOWN:
                        input_key = 'down';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_LEFT:
                        input_key = 'left';
                        key_type = 'input';
                        break;
                case Characteristic.RemoteKey.ARROW_RIGHT:
                        input_key = 'right';
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
                        input_key = 'playpause';
                        key_type = 'media';
                        break;
                case Characteristic.RemoteKey.INFORMATION:
                        input_key = 'nexus';
                        key_type = 'input';
                        break;
        }

        if(key_type == 'input'){
            platform.sgClient.getManager('system_input').sendCommand(input_key).then(function(response){
                // platform.log("Send input key:", input_key);
                callback();
            }, function(error){
                console.log(error)
                callback();
            })

        } else {
            platform.sgClient.getManager('system_media').sendCommand(input_key).then(function(response){
                // platform.log("Send media key:", input_key);
                callback();
            }, function(error){
                console.log(error)
                callback();
            })
        }
}

SmartglassDevice.prototype.set_volume_state = function(state, callback)
{
        var platform = this;
        // platform.log("Setting Volume State...");

        if (state == 0){
            // platform.log("Send ir command:", '0/btn.vol_up');
            platform.sgClient.getManager('tv_remote').sendIrCommand('btn.vol_up').then(function(){
                // platform.log("Send volume up: btn.vol_up");
                callback();
            }, function(error){
                console.log(error)
            })
        } else {
            // platform.log('Send ir command:', '0/btn.vol_down');
            platform.sgClient.getManager('tv_remote').sendIrCommand('btn.vol_down').then(function(){
                // platform.log('Send volume up: btn.vol_down');
                callback();
            }, function(error){
                console.log(error)
            })
        }
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

import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { SmartglassPlatform } from './platform';

import Smartglass from 'xbox-smartglass-core-node';
import SystemInputChannel from 'xbox-smartglass-core-node/src/channels/systeminput';
import SystemMediaChannel from 'xbox-smartglass-core-node/src/channels/systemmedia';
import TvRemoteChannel from 'xbox-smartglass-core-node/src/channels/tvremote';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SmartglassAccessory {
  private service: Service;
  private speakerService: Service;

  /**
   * These are just used to create a working example
   * You should implement your own code to track the state of your accessory
   */
  private exampleStates = {
    On: false,
    Brightness: 100,
  };

  private SGClient = Smartglass();
  private deviceState = {
    isConnected: false,
    powerState: false
  }

  constructor(
    private readonly platform: SmartglassPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Microsoft')
      .setCharacteristic(this.platform.Characteristic.Model, 'Xbox Series S')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.liveid);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Television) || this.accessory.addService(this.platform.Service.Television);

    accessory.category = this.platform.api.hap.Categories.TV_SET_TOP_BOX;

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.name);
    this.service.setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);
    this.service.setCharacteristic(this.platform.Characteristic.FirmwareRevision, require('../package.json').version)

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setOn.bind(this))
      .on('get', this.getOn.bind(this))

    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .on('set', this.setRemoteKey.bind(this))

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 1);

    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb

    // register handlers for the On/Off Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.On)
    //   .on('set', this.setOn.bind(this))                // SET - bind to the `setOn` method below
    //   .on('get', this.getOn.bind(this));               // GET - bind to the `getOn` method below

    // register handlers for the Brightness Characteristic
    // this.service.getCharacteristic(this.platform.Characteristic.Brightness)
    //   .on('set', this.setBrightness.bind(this));       // SET - bind to the 'setBrightness` method below

    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);
    this.speakerService.setCharacteristic(this.platform.Characteristic.Active, 1)
    this.speakerService.setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE)

    this.speakerService
        .getCharacteristic(this.platform.Characteristic.VolumeSelector)
        .on('set', this.setVolume.bind(this));

    this.service.addLinkedService(this.speakerService);

    /**
     * Creating multiple services of the same type.
     * 
     * To avoid "Cannot add a Service with the same UUID another Service without also defining a unique 'subtype' property." error,
     * when creating multiple services of the same type, you need to use the following syntax to specify a name and subtype id:
     * this.accessory.getService('NAME') || this.accessory.addService(this.platform.Service.Lightbulb, 'NAME', 'USER_DEFINED_SUBTYPE_ID');
     * 
     * The USER_DEFINED_SUBTYPE must be unique to the platform accessory (if you platform exposes multiple accessories, each accessory
     * can use the same sub type id.)
     */

    // Example: add two "motion sensor" services to the accessory
    // const motionSensorOneService = this.accessory.getService('Motion Sensor One Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor One Name', 'YourUniqueIdentifier-1');

    // const motionSensorTwoService = this.accessory.getService('Motion Sensor Two Name') ||
    //   this.accessory.addService(this.platform.Service.MotionSensor, 'Motion Sensor Two Name', 'YourUniqueIdentifier-2');

    /**
     * Updating characteristics values asynchronously.
     * 
     * Example showing how to update the state of a Characteristic asynchronously instead
     * of using the `on('get')` handlers.
     * Here we change update the motion sensor trigger states on and off every 10 seconds
     * the `updateCharacteristic` method.
     * 
     */
    // let motionDetected = false;
    // setInterval(() => {
    //   // EXAMPLE - inverse the trigger
    //   motionDetected = !motionDetected;

    //   // push the new value to HomeKit
    //   motionSensorOneService.updateCharacteristic(this.platform.Characteristic.MotionDetected, motionDetected);
    //   motionSensorTwoService.updateCharacteristic(this.platform.Characteristic.MotionDetected, !motionDetected);

    //   this.platform.log.debug('Triggering motionSensorOneService:', motionDetected);
    //   this.platform.log.debug('Triggering motionSensorTwoService:', !motionDetected);
    // }, 10000);

    setInterval(() => {
      // console.log(this.SGClient)
      this.platform.log.debug('Device status:', this.deviceState.isConnected ? 'Connected':'Disconnected' );

      if(this.deviceState.isConnected === true){
        // Client is connected
        // this.platform.log.debug('Client is already connected. Do nothing');
      } else {
        // Client is not connected, try to connect
        
        this.SGClient = Smartglass(); // Needed for now to prevent a memory leak on a long run

        this.SGClient.discovery(accessory.context.device.ipaddress).then(() => {
          this.platform.log.debug('Xbox found on the network:', accessory.context.device.ipaddress);

          // Lets connect
          this.SGClient.connect(accessory.context.device.ipaddress).then(() => {
            this.platform.log.debug('Connected to xbox on ip:', accessory.context.device.ipaddress);
            this.deviceState.isConnected = true;
            this.deviceState.powerState = true;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);

            // Setup Smartglass client config
            this.SGClient.addManager('system_input', SystemInputChannel())
            this.SGClient.addManager('system_media', SystemMediaChannel())
            this.SGClient.addManager('tv_remote', TvRemoteChannel())

            this.SGClient.on('_on_timeout', () => {
              this.platform.log.info('Smartglass connection timeout detected. Reconnecting...');
              this.deviceState.isConnected = false
            })

          }).catch((error) => {
            this.platform.log.debug('Failed to connect to xbox. Reason:', error);
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
          })
        }).catch(() => {
          this.platform.log.debug('Failed to discover xbox on ip:', accessory.context.device.ipaddress);
          this.deviceState.isConnected = false;
          this.deviceState.powerState = false;
        })
      }
    }, 10000);
    
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // this.deviceState.isConnected = false;

    this.platform.log.debug('Set Characteristic On ->', value, this.deviceState.powerState, (this.deviceState.powerState == value));
    
    if(this.deviceState.powerState == value){
      this.platform.log.debug('Set Characteristic not changes. Ignoring ('+value+')');
    } else {

      this.platform.log.debug('Set Characteristic On ->', value);
      if(value === 0){
        // Power off
        this.SGClient.powerOff().then(() => {
          this.platform.log.debug('Powered off xbox');
          this.deviceState.isConnected = false;
          this.deviceState.powerState = false;
          this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);
  
        }).then((error) => {
          this.platform.log.debug('Failed to turn off xbox:', error);
          this.deviceState.isConnected = false;
          this.deviceState.powerState = false;
        })
      } else {

        // Power on
        this.SGClient.powerOn({
          tries: 10,
          ip: this.accessory.context.device.ipaddress,
          live_id: this.accessory.context.device.liveid,
        }).then(() => {
          this.platform.log.debug('Powered on xbox');
          this.deviceState.isConnected = true;
  
        }).then((error) => {
          this.platform.log.debug('Failed to turn on xbox:', error);
          this.deviceState.isConnected = false;
        })
      }
      
    }
    // you must call the callback function
    callback(null);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   * 
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   * 
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  getOn(callback: CharacteristicGetCallback) {

    // implement your own code to check if the device is on
    const isOn = this.deviceState.isConnected;

    this.platform.log.debug('Get Characteristic On ->', isOn);

    // you must call the callback function
    // the first argument should be null if there were no errors
    // the second argument should be the value to return
    callback(null, isOn);
  }

  setRemoteKey(newValue: CharacteristicValue, callback: CharacteristicSetCallback) {

    var inputKey
    var inputType
    // implement your own code to check if the device is on
    switch(newValue) {
      case this.platform.Characteristic.RemoteKey.REWIND: {
        this.platform.log.debug('set Remote Key Pressed: REWIND');
        break;
      }
      case this.platform.Characteristic.RemoteKey.FAST_FORWARD: {
        this.platform.log.debug('set Remote Key Pressed: FAST_FORWARD');
        break;
      }
      case this.platform.Characteristic.RemoteKey.NEXT_TRACK: {
        this.platform.log.debug('set Remote Key Pressed: NEXT_TRACK');
        break;
      }
      case this.platform.Characteristic.RemoteKey.PREVIOUS_TRACK: {
        this.platform.log.debug('set Remote Key Pressed: PREVIOUS_TRACK');
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_UP: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_UP');
        inputKey = 'up'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
        inputKey = 'down'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
        inputKey = 'left'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
        inputKey = 'right'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.SELECT: {
        this.platform.log.debug('set Remote Key Pressed: SELECT');
        inputKey = 'a'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.BACK: {
        this.platform.log.debug('set Remote Key Pressed: BACK');
        inputKey = 'b'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.EXIT: {
        this.platform.log.debug('set Remote Key Pressed: EXIT');
        inputKey = 'nexus'
        inputType = 'input'
        break;
      }
      case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
        inputKey = 'playpause'
        inputType = 'media'
        break;
      }
      case this.platform.Characteristic.RemoteKey.INFORMATION: {
        this.platform.log.debug('set Remote Key Pressed: INFORMATION');
        inputKey = 'nexus'
        inputType = 'input'
        break;
      }
    }

    if(inputType == 'input'){
      this.SGClient.getManager('system_input').sendCommand(inputKey).then((response) => {
        // platform.log("Send input key:", input_key);
        callback(null);

      }).catch((error) => {
        this.platform.log.info('Error sendding key input', inputKey, error)
        callback(null);
      })

    } else {
      this.SGClient.getManager('system_media').sendCommand(inputKey).then((response) => {
        // platform.log("Send media key:", input_key);
        callback(null);

      }).catch((error) => {
        this.platform.log.info('Error sending key input', inputKey, error)
        callback(null);
      })
    }
  }

  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // 0 = up, 1 = down
    this.platform.log.debug('setVolume called with: ' + value);

    this.SGClient.getManager('tv_remote').sendIrCommand(value?'btn.vol_down':'btn.vol_up').then(() => {
      this.platform.log.debug('Sent command ', value?'vol_down':'vol_up')
    // this.SGClient.getManager('system_input').sendCommand(value?'vol_down':'vol_up').then((response) => {
      // platform.log("Send input key:", input_key);
      callback(null);

    }).catch((error) => {
      this.platform.log.info('Error sendding key input', value?'vol_down':'vol_up', error)
      callback(null);
    })

    // let command = this.device.codes.volume.up;
    // if (value === this.platform.Characteristic.VolumeSelector.DECREMENT) {
    //   command = this.device.codes.volume.down;
    // }

    // this.socketClient.sendCommand('IR-SEND', command)
    //   .catch((e) => this.platform.log.error(e));
    // this.platform.log.debug('Sending code: ' + command);
    // callback(null);
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  setBrightness(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // implement your own code to set the brightness
    this.exampleStates.Brightness = value as number;

    this.platform.log.debug('Set Characteristic Brightness -> ', value);

    // you must call the callback function
    callback(null);
  }

}

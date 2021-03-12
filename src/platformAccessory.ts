import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { SmartglassPlatform } from './platform';

import Smartglass from 'xbox-smartglass-core-node';
import SystemInputChannel from 'xbox-smartglass-core-node/src/channels/systeminput';
import SystemMediaChannel from 'xbox-smartglass-core-node/src/channels/systemmedia';
import TvRemoteChannel from 'xbox-smartglass-core-node/src/channels/tvremote';

import packageInfo from './package-info.json';
import XboxApi from 'xbox-webapi';

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
  private ApiClient = XboxApi({
    clientId: this.platform.config.clientId || '5e5ead27-ed60-482d-b3fc-702b28a97404',
    clientSecret: this.platform.config.clientSecret || false,
  });

  private deviceState = {
    isConnected: false,
    powerState: false,
    webApiEnabled: false,
    currentAumId: '',
    currentTitleId: '',
  };

  private inputSources = [
    {
      name: 'Other',
      type: this.platform.Characteristic.InputSourceType.OTHER,
      hidden: true,
      aum_id: '0',
      title_id: '',
    }, {
      name: 'Dashboard',
      type: this.platform.Characteristic.InputSourceType.HOME_SCREEN,
      aum_id: 'Xbox.Dashboard_8wekyb3d8bbwe!Xbox.Dashboard.Application',
      hidden: true,
      title_id: '',
    },
  ];

  private appTitleCache:any[] = [];

  constructor(
    private readonly platform: SmartglassPlatform,
    private readonly accessory: PlatformAccessory,
  ) {

    // Setup api
    this.platform.log.debug('Checking Xbox api capabilities...');

    this.ApiClient._authentication._tokensFile = this.platform.api.user.storagePath()+'/.smartglass.tokens.json';
    this.ApiClient.isAuthenticated().then(() => {
      // User is authenticated
      this.platform.log.debug('User is authenticated with the Xbox api. Enabling functionalities');
      this.deviceState.webApiEnabled = true;

      this.getModel(this.accessory.context.device.liveid);

    }).catch(() => {
      this.platform.log.info('Xbox login url available at:', this.ApiClient._authentication.generateAuthorizationUrl());
      this.platform.log.info('Copy the token after login into you config: "apiToken": "<value>" to enable the Xbox api');
      this.platform.log.debug('Current Token:', this.platform.config.apiToken);

      if(this.platform.config.apiToken !== undefined){
        this.platform.log.info('Trying to authenticate using configured token...');

        this.ApiClient._authentication.getTokenRequest(this.platform.config.apiToken).then((data) => {
          this.platform.log.info('User is authenticated');
          this.platform.log.debug('Got oauth token:', data);

          this.ApiClient._authentication._tokens.oauth = data;
          this.ApiClient._authentication.saveTokens();
          this.deviceState.webApiEnabled = true;

          this.getModel(this.accessory.context.device.liveid);

        }).catch((error) =>{
          this.platform.log.info('User failed to authenticate:', error);
        });
      } else {
        // Xbox webapi not available
        this.platform.log.info('User failed to authenticate. Disabling Xbox api functionalities');
      }
    });

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Microsoft')
      .setCharacteristic(this.platform.Characteristic.Model, 'Xbox - Not authenticated')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.liveid)
      .setCharacteristic(this.platform.Characteristic.SoftwareRevision, packageInfo.version);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Television)||this.accessory.addService(this.platform.Service.Television);

    accessory.category = this.platform.api.hap.Categories.TV_SET_TOP_BOX;

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.ConfiguredName, accessory.context.device.name);
    this.service.setCharacteristic(this.platform.Characteristic.SleepDiscoveryMode, this.platform.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE);

    this.service.getCharacteristic(this.platform.Characteristic.Active)
      .on('set', this.setOn.bind(this))
      .on('get', this.getOn.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.RemoteKey)
      .on('set', this.setRemoteKey.bind(this));

    this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, 1);

    this.service.getCharacteristic(this.platform.Characteristic.ActiveIdentifier)
      .on('set', this.setCurrentApplication.bind(this))
      .on('get', this.getCurrentApplication.bind(this));

    // Speaker service
    this.speakerService = this.accessory.getService(this.platform.Service.TelevisionSpeaker) || this.accessory.addService(this.platform.Service.TelevisionSpeaker);
    this.speakerService.setCharacteristic(this.platform.Characteristic.Active, 1);
    this.speakerService.setCharacteristic(this.platform.Characteristic.VolumeControlType, this.platform.Characteristic.VolumeControlType.ABSOLUTE);

    this.speakerService
      .getCharacteristic(this.platform.Characteristic.VolumeSelector)
      .on('set', this.setVolume.bind(this));

    this.service.addLinkedService(this.speakerService);

    // Prepare input sources
    for(const app in this.accessory.context.device.inputs){
      this.platform.log.debug('Adding input source to config:', this.accessory.context.device.inputs[app].name);

      this.inputSources.push({
        name: this.accessory.context.device.inputs[app].name,
        type: this.platform.Characteristic.InputSourceType.APPLICATION,
        aum_id: this.accessory.context.device.inputs[app].aum_id,
        title_id: this.accessory.context.device.inputs[app].title_id || '',
        hidden: false,
      });

    }

    // Configure input sources
    for(const id in this.inputSources){
      const inputSource = this.accessory.getService('input'+id) || this.accessory.addService(this.platform.Service.InputSource, 'input'+id, 'input'+id);

      inputSource.setCharacteristic(this.platform.Characteristic.IsConfigured, this.platform.Characteristic.IsConfigured.CONFIGURED);
      inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, this.inputSources[id].name);
      inputSource.setCharacteristic(this.platform.Characteristic.InputSourceType, this.inputSources[id].type || this.platform.Characteristic.InputSourceType.HOME_SCREEN);
      inputSource.setCharacteristic(this.platform.Characteristic.Identifier, (parseInt(id)+1));

      if(this.inputSources[id].hidden === true){
        inputSource.setCharacteristic(this.platform.Characteristic.CurrentVisibilityState, this.platform.Characteristic.CurrentVisibilityState.HIDDEN);
      }
      
      this.service.addLinkedService(inputSource);
    }

    setInterval(() => {
      // console.log(this.SGClient)
      this.platform.log.debug('Device status:', this.deviceState.isConnected ? 'Connected':'Disconnected' );

      if(this.deviceState.isConnected === true){
        // Client is connected
        // this.platform.log.debug('Client is already connected. Do nothing');
        
        this.platform.log.debug('- SGCLient _connection_status:', this.SGClient._connection_status);
        this.platform.log.debug('- SGCLient isConnected:', this.SGClient.isConnected());

        // @TODO: Check if we are still connected to the console.
      } else {
        // Client is not connected, try to connect
        
        this.SGClient = Smartglass(); // Needed for now to prevent a memory leak on a long run

        this.SGClient.discovery(accessory.context.device.ipaddress).then(() => {
          this.platform.log.debug('Xbox found on the network:', accessory.context.device.ipaddress);

          // Lets connect
          this.connectConsole();
          
        }).catch(() => {
          this.platform.log.debug('Failed to discover xbox on ip:', accessory.context.device.ipaddress);
          this.deviceState.isConnected = false;
          this.deviceState.powerState = false;
        });
      }
    }, 10000);
    
  }

  connectConsole(){
    this.SGClient = Smartglass();

    this.SGClient.connect(this.accessory.context.device.ipaddress).then(() => {
      this.platform.log.debug('Connected to xbox on ip:', this.accessory.context.device.ipaddress);
      this.deviceState.isConnected = true;
      this.deviceState.powerState = true;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);

      // Setup Smartglass client config
      this.SGClient.addManager('system_input', SystemInputChannel());
      this.SGClient.addManager('system_media', SystemMediaChannel());
      this.SGClient.addManager('tv_remote', TvRemoteChannel());

      this.SGClient.on('_on_timeout', () => {
        this.platform.log.info('Smartglass connection timeout detected. Reconnecting...');
        this.deviceState.isConnected = false;
        this.deviceState.powerState = false;
        this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);
        this.connectConsole();
      });

      this.SGClient.on('_on_console_status', (response) => {
        // @TODO: Rewrite this part so it uses the Smartglass class
        if(response.packet_decoded.protected_payload.apps[0] !== undefined){
          if(this.deviceState.currentAumId !== response.packet_decoded.protected_payload.apps[0].aum_id){
            this.deviceState.currentAumId = response.packet_decoded.protected_payload.apps[0].aum_id;
            this.deviceState.currentTitleId = response.packet_decoded.protected_payload.apps[0].title_id;

            const activeInputId = this.getAppId(this.deviceState.currentAumId, this.deviceState.currentTitleId);

            // this.platform.log.info('[Smartglass] Xbox switched to app:', response.packet_decoded.protected_payload.apps[0], activeInputId)
            this.platform.log.info('Xbox app change detected. aum_id:', response.packet_decoded.protected_payload.apps[0].aum_id,
              'title_id:', response.packet_decoded.protected_payload.apps[0].title_id);

            // const inputSource = this.accessory.getService('input1') || this.accessory.addService(this.platform.Service.InputSource, 'input1', 'input1');

            // this.getAppByTitleId(this.deviceState.currentTitleId).then((result:any) => {
            //   this.platform.log.info('Set source to:', result.LocalizedProperties[0].ShortTitle || result.LocalizedProperties[0].ProductTitle);
            //   // inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, result.LocalizedProperties[0].ShortTitle || result.LocalizedProperties[0].ProductTitle);
            //   inputSource.updateCharacteristic(this.platform.Characteristic.ConfiguredName, result.LocalizedProperties[0].ShortTitle || result.LocalizedProperties[0].ProductTitle);
            //   // this.service.setCharacteristic(this.platform.Characteristic.ActiveIdentifier, activeInputId);
            // }).catch(() => {
            //   this.platform.log.info('Set source to other');
            //   inputSource.updateCharacteristic(this.platform.Characteristic.ConfiguredName, 'Other');
            //   // inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, 'Other');
            // });

            this.service.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, activeInputId);
          }
        }
      });

    }).catch((error) => {
      this.platform.log.debug('Failed to connect to xbox. Reason:', error);
      this.deviceState.isConnected = false;
      this.deviceState.powerState = false;
      this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);
    });
  }

  getAppId(aum_id: string, title_id: string) {
 
    if(this.deviceState.webApiEnabled === true){
      // Lookup on xbox store
      const appCache = this.getAppFromCache(title_id);
      // var inputSource = this.accessory.getService('input1') || this.accessory.addService(this.platform.Service.InputSource, 'input1', 'input1');

      if(appCache !== false){
        // App is cached, return results
        this.platform.log.debug('getAppId() return app from cache:', appCache.LocalizedProperties[0].ShortTitle, title_id);
        // inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, appCache.LocalizedProperties[0].ShortTitle);
      } else {
        // App is not cached, get results
        this.ApiClient.isAuthenticated().then(() => {
          if(title_id !== '') {
            this.ApiClient.getProvider('catalog').getProductFromAlternateId(title_id, 'XboxTitleId').then((result) => {
              if(result.Products[0] !== undefined){
                this.platform.log.debug('getAppId() return app from xbox api:', result.Products[0].LocalizedProperties[0].ShortTitle, title_id);
                this.appTitleCache.push(result.Products[0]);
      
                // inputSource.setCharacteristic(this.platform.Characteristic.ConfiguredName, result.Products[0].LocalizedProperties[0].ShortTitle);
              } else {
                this.platform.log.info('Failed to retrieve titleid from Xbox api (getAppId):', title_id);
              }
            }).catch((error) => {
              this.platform.log.info('Failed to retrieve titleid from Xbox api (getAppId):', title_id, error);
            });
          } else {
            // No app id, do nothing.
          }
        }).catch((error) => {
          this.platform.log.info('Failed to authenticate user:', error);
        });
      }
    }

    // Match on App URI
    for(const app in this.inputSources){
      if(aum_id === this.inputSources[app].aum_id){
        this.platform.log.debug('getAppId() - Match app on config list:', app);
        return parseInt(app)+1;
      }
    }

    return 1;
  }

  getAppFromCache(title_id: string) {
    // Match on App URI
    for(const app in this.appTitleCache){
      for(const alt_ids in this.appTitleCache[app].AlternateIds){
        if(this.appTitleCache[app].AlternateIds[alt_ids].IdType === 'XboxTitleId' && this.appTitleCache[app].AlternateIds[alt_ids].Value === title_id){
          return this.appTitleCache[app];
        }
      }
    }
    return false;
  }

  getAppByTitleId(title_id: string) {
    return new Promise((resolve, reject) => {
      const appCache = this.getAppFromCache(title_id);

      if(title_id === undefined || title_id === ''){
        reject('Cannot resolve empty title_id (getAppByTitleId):'+ title_id);
      } else {

        if(appCache !== false){
          return resolve(appCache);
        } else {
          this.ApiClient.isAuthenticated().then(() => {
            this.ApiClient.getProvider('catalog').getProductFromAlternateId(title_id, 'XboxTitleId').then((result) => {
              if(result.Products[0] !== undefined){
                this.platform.log.debug('getAppByTitleId() return app from xbox api:', result.Products[0].LocalizedProperties[0].ShortTitle, title_id);
                this.appTitleCache.push(result.Products[0]);
                resolve(result.Products[0]);
              } else {
                this.platform.log.info('Failed to retrieve titleid from Xbox api (getAppByTitleId):', title_id);
                reject('Failed to retrieve titleid from Xbox api:'+ title_id);
              }
            }).catch((error) => {
              this.platform.log.info('Failed to retrieve titleid from Xbox api (getAppByTitleId):', title_id, error);
              reject('Failed to retrieve titleid from Xbox api:'+ title_id);
            });
          }).catch((error) => {
            this.platform.log.info('Failed to authenticate user:', error);
            reject(error);
          });
        }

      }
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  setOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {

    // this.deviceState.isConnected = false;

    
    if((this.deviceState.powerState?1:0) === value){
      this.platform.log.debug('Set Characteristic not changes. Ignoring ('+value+')');
    } else {

      this.platform.log.debug('Set Characteristic On ->', value);
      if(value === 0){
        // Power off
        if(this.deviceState.webApiEnabled === true){
          this.ApiClient.isAuthenticated().then(() => {
            this.ApiClient.getProvider('smartglass').powerOff(this.accessory.context.device.liveid).then(() => {
              this.platform.log.debug('Powered off xbox using xbox api');
              this.deviceState.isConnected = false;
              this.deviceState.powerState = false;
              // this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);

            }).catch((error) => {
              this.platform.log.info('Failed to turn off xbox using xbox api:', error);
              this.deviceState.isConnected = false;
              this.deviceState.powerState = false;
            });
          }).catch((error) => {
            this.platform.log.info('Failed to turn off xbox using xbox api:', error);
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
          });
        } else {
          this.SGClient.powerOff().then(() => {
            this.platform.log.debug('Powered off xbox using smartglass');
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
            // this.service.updateCharacteristic(this.platform.Characteristic.Active, 0);
    
          }).catch((error) => {
            this.platform.log.info('Failed to turn off xbox using smartglass:', error);
            this.deviceState.isConnected = false;
            this.deviceState.powerState = false;
          });
        }
      } else {

        if(this.deviceState.webApiEnabled === true){
          this.ApiClient.isAuthenticated().then(() => {
            this.ApiClient.getProvider('smartglass').powerOn(this.accessory.context.device.liveid).then(() => {
              this.platform.log.debug('Powered on xbox using xbox api');
              this.deviceState.powerState = true;
              this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);

            }).catch((error) => {
              this.platform.log.info('Failed to turn on xbox using xbox api:', error);
              this.deviceState.isConnected = false;
              this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
            });
          }).catch((error) => {
            this.platform.log.info('Failed to turn on xbox using xbox api:', error);
            this.deviceState.isConnected = false;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
          });
        } else {
          // Power on
          this.SGClient.powerOn({
            tries: 10,
            ip: this.accessory.context.device.ipaddress,
            live_id: this.accessory.context.device.liveid,
          }).then(() => {
            this.platform.log.debug('Powered on xbox using smartglass');
            this.deviceState.powerState = true;
            this.service.updateCharacteristic(this.platform.Characteristic.Active, 1);
    
          }).catch((error) => {
            this.platform.log.info('Failed to turn on xbox using smartglass:', error);
            this.deviceState.isConnected = false;
          });
        }
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

    let inputKey;
    let inputType;
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
        inputKey = 'up';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_DOWN: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_DOWN');
        inputKey = 'down';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_LEFT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_LEFT');
        inputKey = 'left';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.ARROW_RIGHT: {
        this.platform.log.debug('set Remote Key Pressed: ARROW_RIGHT');
        inputKey = 'right';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.SELECT: {
        this.platform.log.debug('set Remote Key Pressed: SELECT');
        inputKey = 'a';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.BACK: {
        this.platform.log.debug('set Remote Key Pressed: BACK');
        inputKey = 'b';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.EXIT: {
        this.platform.log.debug('set Remote Key Pressed: EXIT');
        inputKey = 'nexus';
        inputType = 'input';
        break;
      }
      case this.platform.Characteristic.RemoteKey.PLAY_PAUSE: {
        this.platform.log.debug('set Remote Key Pressed: PLAY_PAUSE');
        inputKey = 'playpause';
        inputType = 'media';
        break;
      }
      case this.platform.Characteristic.RemoteKey.INFORMATION: {
        this.platform.log.debug('set Remote Key Pressed: INFORMATION');
        inputKey = 'nexus';
        inputType = 'input';
        break;
      }
    }

    if(inputType === 'input'){
      this.SGClient.getManager('system_input').sendCommand(inputKey).then(() => {
        // platform.log("Send input key:", input_key);
        callback(null);

      }).catch((error) => {
        this.platform.log.info('Error sending key input', inputKey, error, this.SGClient);
        
        // @TODO: Sometimes this.SGClient is not available. Temporary reconnect when this happens to increase reliability
        this.connectConsole();
        callback(null);
      });

    } else {
      this.SGClient.getManager('system_media').sendCommand(inputKey).then(() => {
        // platform.log("Send media key:", input_key);
        callback(null);

      }).catch((error) => {
        this.platform.log.info('Error sending key input', inputKey, error, this.SGClient);
        
        // @TODO: Sometimes this.SGClient is not available. Temporary reconnect when this happens to increase reliability
        this.connectConsole();
        callback(null);
      });
    }
  }

  setVolume(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // 0 = up, 1 = down
    this.platform.log.debug('setVolume called with: ' + value);

    if(this.deviceState.webApiEnabled === false){

      this.SGClient.getManager('tv_remote').sendIrCommand(value?'btn.vol_down':'btn.vol_up').then(() => {
        this.platform.log.debug('Sent command ', value?'vol_down':'vol_up');
        // this.SGClient.getManager('system_input').sendCommand(value?'vol_down':'vol_up').then((response) => {
        // platform.log("Send input key:", input_key);
        callback(null);
  
      }).catch((error) => {
        this.platform.log.info('Error sending key input', value?'vol_down':'vol_up', error);
        callback(null);
      });

    } else {

      this.ApiClient.isAuthenticated().then(() => {
        this.ApiClient.getProvider('smartglass')._sendCommand(this.accessory.context.device.liveid, 'Audio', 'Volume', [{
          'direction': (value ? 'Down':'Up'), 'amount': 1,
        }]).then(() => {
          this.platform.log.debug('Sent volume command to xbox via Xbox api');
        }).catch((error ) => {
          this.platform.log.debug('Failed to send volume command to xbox via Xbox api:', error);
        });
      }).catch((error) => {
        this.platform.log.info('Failed to authenticate user:', error);
      });

      callback(null);

    }
    

    // let command = this.device.codes.volume.up;
    // if (value === this.platform.Characteristic.VolumeSelector.DECREMENT) {
    //   command = this.device.codes.volume.down;
    // }

    // this.socketClient.sendCommand('IR-SEND', command)
    //   .catch((e) => this.platform.log.error(e));
    // this.platform.log.debug('Sending code: ' + command);
    // callback(null);
  }

  setCurrentApplication(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    // this.launchApp(this.accessory.context.config.liveid, this.appMap[newValue.toString()].name, newValue)
    this.platform.log.debug('setCurrentApplication() invoked to ->', value);

    const newValue = parseInt(value.toString())-1;
    const inputSourceTitleId = this.inputSources[newValue].title_id;

    if(this.deviceState.webApiEnabled === true){

      if(inputSourceTitleId !== undefined){
        // Got titleid, launch app.
        this.ApiClient.isAuthenticated().then(() => {
          this.getAppByTitleId(inputSourceTitleId).then((result:any) => {
            // console.log('Launch product id:', result.ProductId);

            this.ApiClient.getProvider('smartglass').launchApp(this.accessory.context.device.liveid, result.ProductId).then(() => {
              this.platform.log.debug('Launched app:', result.Title, '('+result.ProductId+')');
              this.service.updateCharacteristic(this.platform.Characteristic.ActiveIdentifier, value);

            }).catch((error: any) => {
              this.platform.log.info('Rejected app launch (launchApp)', error);
            });
          }).catch((error: any) => {
            this.platform.log.info('Rejected app launch (getAppByTitleId)', error);
          });
        }).catch((error: any) => {
          this.platform.log.info('Rejected app launch (isAuthenticated)', error);
        });
      }
    } else {
      this.platform.log.info('Failed to launch app:', inputSourceTitleId);
      this.platform.log.info('Launching apps is not possible when you are not logged in to the Xbox api. Make sure the Xbox api functionalities are enabled.');
    }

    callback(null, value);
  }

  getCurrentApplication(callback: CharacteristicSetCallback) {
    let activeInputId = 1;

    if(this.deviceState.isConnected === true){
      activeInputId = this.getAppId(this.deviceState.currentAumId, this.deviceState.currentTitleId);
      this.platform.log.debug('getCurrentApplication() returned', activeInputId);
    }

    callback(null, activeInputId);
  }

  getModel(liveid: string) {
    if(this.deviceState.webApiEnabled === true){
      this.ApiClient.getProvider('smartglass').getConsoleStatus(liveid).then((result)=> {
        this.platform.log.debug('Get xbox console type from Xbox API:', result.consoleType);

        let consoleType;

        switch(result.consoleType) {
          case 'XboxSeriesX':
            consoleType = 'Xbox Series X';
            break;
          case 'XboxSeriesS':
            consoleType = 'Xbox Series S';
            break;
          case 'XboxOne':
            consoleType = 'Xbox One';
            break;
          case 'XboxOneS':
            consoleType = 'Xbox One S';
            break;
          case 'XboxOneX':
            consoleType = 'Xbox One X';
            break;
          default:
            consoleType = result.consoleType;
            break;
        }


        this.accessory.getService(this.platform.Service.AccessoryInformation)!
          .setCharacteristic(this.platform.Characteristic.Model, consoleType);

      }).catch((error)=> {
        if(error.errorCode === 'XboxDataNotFound'){
          this.platform.log.info('Console ID not found on connected xbox account. Disabling xbox api functionalities. Live id:', liveid);
          this.deviceState.webApiEnabled = false;
        } else {
          this.platform.log.info('Failed to get xbox console type from Xbox API:', error, 'Live id:', liveid);
        }

        this.ApiClient.getProvider('smartglass').getConsolesList().then((result)=> {
          // this.platform.log.info(result);
          this.platform.log.info('Available consoles:');

          for(const console in result.result){
            // this.platform.log.info('- Name:', result.result[console].name, ' - Console Type:', result.result[console].consoleType, ' - Console Live ID:', result.result[console].id);
            this.platform.log.info('- ['+result.result[console].id+' - '+result.result[console].consoleType+']', result.result[console].name);
          }
        }).catch((error)=> {
          this.platform.log.info('Failed to get console list:', error);
        });
      });
    }
  }

}

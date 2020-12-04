import {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service
} from 'homebridge';

import { PLATFORM_NAME, PLUGIN_NAME } from './Settings';

const Package = require("../package.json")
const XboxApiClient = require("xbox-webapi")
const Smartglass = require("xbox-smartglass-core-node")
const pem = require("pem")

export class SmartglassPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;

  public readonly Characteristic: typeof Characteristic = this.api.hap
    .Characteristic;

  public readonly accessories: PlatformAccessory[] = [];

  public apiClient: typeof XboxApiClient;
  public xboxMap: any = {};
  public appMap: any = {};
  public applications: Array<String>;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.apiClient = XboxApiClient({
      clientId: '5e5ead27-ed60-482d-b3fc-702b28a97404'
    });
    this.applications = this.config.apps || []

    this.log.debug('Finished initializing platform:', this.config.platform);

    this.api.on('didFinishLaunching', async () => {
      log.info('Check for a valid user session with the Xbox Live api');

      // Check if user is authenticated with the xbox live services
      this.apiClient.isAuthenticated().then(() => {
          // User is authenticated
          log.debug('User is authenticated.')
          this.xboxDiscovery()
      
      }).catch((error: any) => {
          // User is not authenticated
          log.debug('User is not authenticated. Starting flow...', error)
          
          var url = this.apiClient.startAuthServer(() => {
            this.apiClient.isAuthenticated().then(() => {
              log.info('User has been logged in')
              this.xboxDiscovery()

            }).catch((error: any) => {
              log.info(error)
            })
          })
          log.warn('Open the following link to authenticate with the Xbox Live API:', url)
      })
    });
  }

  configureAccessory(accessory: PlatformAccessory): void {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    this.accessories.push(accessory);
  }

  removeAccessories() {
    this.log.info("Removing all accessories");

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
    this.accessories.splice(0, this.accessories.length); // clear out the array
  }

  xboxDiscovery() {
    this.log.info("Refreshing list of xbox consoles");

    this.apiClient.getProvider('smartglass').getConsolesList().then((result: any) => {
      this.log.debug('Xbox consoles found:', result.result)

      this.removeAccessories()
      for(let device in result.result){
        this.addAccessory(result.result[device].name, result.result[device].id, result.result[device].consoleType)
      }
    }).catch((error: any) => {
      this.log.warn('Error refreshing consoles:', error)
    })
  }

  launchApp(consoleId: String, titleName: String, identifierId: Number) {
    this.log.info("Change input on:", consoleId, 'to', this.appMap[identifierId.toString()].name);

    if(this.appMap[identifierId.toString()].storeId === undefined){
      // Storeid is not cached, search for product in store
      this.apiClient.getProvider('catalog').searchTitle(titleName).then((result: any) => {
        this.log.debug('Found app/game in the store:', result.Results[0].Products[0].Title, '('+result.Results[0].Products[0].ProductId+')')
        this.appMap[identifierId.toString()].storeId = result.Results[0].Products[0].ProductId
  
        this.apiClient.getProvider('smartglass').launchApp(consoleId, result.Results[0].Products[0].ProductId).then((resultLaunch: any) => {
          this.log.debug('Launched app:', result.Results[0].Products[0].Title, '('+result.Results[0].Products[0].ProductId+')')
        }).catch((error: any) => {
          this.log.debug('Rejected app launch', error)
        })
  
      }).catch((error: any) => {
        this.log.debug('Rejected store search', error)
      })
    } else {
      // We got an storeId in cache. Launch app right away
      this.apiClient.getProvider('smartglass').launchApp(consoleId, this.appMap[identifierId.toString()].storeId).then((resultLaunch: any) => {
        this.log.debug('Launched app', this.appMap[identifierId.toString()].name, '('+this.appMap[identifierId.toString()].storeId+')')
      }).catch((error: any) => {
        this.log.debug('Rejected app launch', error)
      })
    }
  }

  addAccessory(name: string, liveid: string, consoletype: string) {
    // uuid must be generated from a unique but not changing data source, name should not be used in the most cases. But works in this specific example.
    const uuid = this.api.hap.uuid.generate('homebridge:smartglass'+liveid);

    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      this.log.info("Adding new accessory with name %s", name);

      const accessory = new this.api.platformAccessory(name, uuid);

      accessory.category = this.api.hap.Categories.TELEVISION;

      var televisionService: any = accessory.addService(this.api.hap.Service.Television)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, name)
        .setCharacteristic(this.api.hap.Characteristic.SleepDiscoveryMode, this.api.hap.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
        .setCharacteristic(this.api.hap.Characteristic.ActiveIdentifier, 1)
        .setCharacteristic(this.api.hap.Characteristic.Active, 1)

      var informationService: any = accessory.getService(this.api.hap.Service.AccessoryInformation)
      informationService.setCharacteristic(this.api.hap.Characteristic.Manufacturer, 'Microsoft')
        .setCharacteristic(this.api.hap.Characteristic.Model, consoletype)
        .setCharacteristic(this.api.hap.Characteristic.SerialNumber, liveid)
        .setCharacteristic(this.api.hap.Characteristic.FirmwareRevision, Package.version)
        // .setCharacteristic(this.api.hap.Characteristic.HardwareRevision, Package.version)
        // .setCharacteristic(this.api.hap.Characteristic.SoftwareRevision, Package.version)

      var inputSourceDashboard: any = accessory.addService(this.api.hap.Service.InputSource, 'dashboard', 'Dashboard')
      inputSourceDashboard.setCharacteristic(this.api.hap.Characteristic.Identifier, 1)
        .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, 'Dashboard')
        .setCharacteristic(this.api.hap.Characteristic.IsConfigured, this.api.hap.Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(this.api.hap.Characteristic.InputSourceType, this.api.hap.Characteristic.InputSourceType.HOME_SCREEN)
      televisionService.addLinkedService(inputSourceDashboard);

      this.appMap = {
        1: {
          name: 'Dashboard',
          id: 'dashboard',
        }
      }

      if(consoletype != 'XboxSeriesS' && consoletype != 'XboxSeriesX'){
        var inputSourceTv: any = accessory.addService(this.api.hap.Service.InputSource, 'tv', 'TV')
        inputSourceTv.setCharacteristic(this.api.hap.Characteristic.Identifier, 2)
          .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, 'TV')
          .setCharacteristic(this.api.hap.Characteristic.IsConfigured, this.api.hap.Characteristic.IsConfigured.CONFIGURED)
          .setCharacteristic(this.api.hap.Characteristic.InputSourceType, this.api.hap.Characteristic.InputSourceType.TUNER)
        televisionService.addLinkedService(inputSourceTv);

        this.appMap[2] = {
          name: 'Tv',
          id: 'tv'
        }
      }

      // Set apps here
      var appIdentifier = 3
      for(var app in this.applications){
        var inputSourceDashboard: any = accessory.addService(this.api.hap.Service.InputSource, this.applications[app], this.applications[app])
        inputSourceDashboard.setCharacteristic(this.api.hap.Characteristic.Identifier, appIdentifier)
          .setCharacteristic(this.api.hap.Characteristic.ConfiguredName, this.applications[app])
          .setCharacteristic(this.api.hap.Characteristic.IsConfigured, this.api.hap.Characteristic.IsConfigured.CONFIGURED)
          .setCharacteristic(this.api.hap.Characteristic.InputSourceType, this.api.hap.Characteristic.InputSourceType.APPLICATION)
        televisionService.addLinkedService(inputSourceDashboard);
        
        this.appMap[appIdentifier] = {
          name: this.applications[app],
          id: this.applications[app],
        }

        appIdentifier++;
      }

      televisionService.getCharacteristic(this.api.hap.Characteristic.ActiveIdentifier)
        .on('set', (newValue: Number, callback: Function) => {
          this.launchApp(liveid, this.appMap[newValue.toString()].name, newValue)

          callback(null);
        })

      televisionService.getCharacteristic(this.api.hap.Characteristic.Active)
        .on('get', (callback: Function) => {
          this.log.debug('Request power state');

          if(this.xboxMap[liveid] == undefined){
            this.log.debug('Xbox not found before on network. Trying to get ip address...');
            // Perform full network search
            Smartglass().discovery().then((consoles: any) => {
              for(var xbox in consoles){

                const certPem = '-----BEGIN CERTIFICATE-----\n'+consoles[xbox].message.certificate.toString('base64').match(/.{0,64}/g).join('\n')+'-----END CERTIFICATE-----'
                pem.readCertificateInfo(certPem, (error: any, certInfo: any) => {
                  // Set ip address in xboxMap
                  this.xboxMap[certInfo.commonName] = consoles[xbox].remote.address
                })
              }

              // Check if we have detected the console we are looking for
              setTimeout(() => {
                if(this.xboxMap[liveid] == undefined){
                  this.log.debug('Xbox is offline (not found on network)', this.xboxMap);
                  callback(null, false)
                } else {
                  Smartglass().discovery(this.xboxMap[liveid]).then((consoles: any) => {
                    this.log.debug('Xbox is online');
                    callback(null, true)
                  }).catch((error: any) => {
                    this.log.debug('Xbox is offline. Reason:', error);
                    callback(null, false)
                  })
                }
              }, 500)
            })
          } else {
            this.log.debug('Xbox found on network before. Trying to ping', this.xboxMap[liveid]);

            Smartglass().discovery(this.xboxMap[liveid]).then((consoles: any) => {
              this.log.debug('Xbox is online');
              callback(null, true)
            }).catch((error: any) => {
              this.log.debug('Xbox is offline. Reason:', error);
              callback(null, false)
            })
          }
        })

      televisionService.getCharacteristic(this.api.hap.Characteristic.RemoteKey).on('set', (newValue: Number, callback: Function) => {
        this.log.info('set Remote Key Pressed: ', newValue)

        switch(newValue) {
          case this.api.hap.Characteristic.RemoteKey.REWIND: {
            this.log.info('set Remote Key Pressed: REWIND');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.FAST_FORWARD: {
            this.log.info('set Remote Key Pressed: FAST_FORWARD');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.NEXT_TRACK: {
            this.log.info('set Remote Key Pressed: NEXT_TRACK');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.PREVIOUS_TRACK: {
            this.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_UP: {
            this.log.info('set Remote Key Pressed: ARROW_UP');
            this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Up').then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_DOWN: {
            this.log.info('set Remote Key Pressed: ARROW_DOWN');
            this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Down').then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_LEFT: {
            this.log.info('set Remote Key Pressed: ARROW_LEFT');
            this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Left').then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.ARROW_RIGHT: {
            this.log.info('set Remote Key Pressed: ARROW_RIGHT');
            this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Right').then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.SELECT: {
            this.log.info('set Remote Key Pressed: SELECT');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.BACK: {
            this.log.info('set Remote Key Pressed: BACK');
            this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'B').then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.EXIT: {
            this.log.info('set Remote Key Pressed: EXIT');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.PLAY_PAUSE: {
            this.log.info('set Remote Key Pressed: PLAY_PAUSE');
            break;
          }
          case this.api.hap.Characteristic.RemoteKey.INFORMATION: {
            this.log.info('set Remote Key Pressed: INFORMATION');
            this.apiClient.getProvider('smartglass').openGuideTab(liveid).then(() => {}).catch((error: any) => {
              this.log.info('Error sending button press:', error)
            })
            break;
          }
        }

        callback(null);
      })

      this.configureAccessory(accessory); // abusing the configureAccessory here

      // this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
      return [accessory]
    } else {
      this.log.info("Accessory already exists: %s", name);
    }
  }

}
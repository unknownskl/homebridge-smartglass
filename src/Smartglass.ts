import http, {IncomingMessage, Server, ServerResponse} from "http";
import {
  API,
  APIEvent,
  CharacteristicEventTypes,
  CharacteristicSetCallback,
  CharacteristicValue,
  DynamicPlatformPlugin,
  HAP,
  Logging,
  PlatformAccessory,
  PlatformAccessoryEvent,
  PlatformConfig,
} from "homebridge";

const XboxApiClient = require("xbox-webapi")
const Smartglass = require("xbox-smartglass-core-node")
const Package = require("../package.json")
var pem = require('pem')

const PLUGIN_NAME = "homebridge-smartglass";
const PLATFORM_NAME = "Smartglass";

/*
 * IMPORTANT NOTICE
 *
 * One thing you need to take care of is, that you never ever ever import anything directly from the "homebridge" module (or the "hap-nodejs" module).
 * The above import block may seem like, that we do exactly that, but actually those imports are only used for types and interfaces
 * and will disappear once the code is compiled to Javascript.
 * In fact you can check that by running `npm run build` and opening the compiled Javascript file in the `dist` folder.
 * You will notice that the file does not contain a `... = require("homebridge");` statement anywhere in the code.
 *
 * The contents of the above import statement MUST ONLY be used for type annotation or accessing things like CONST ENUMS,
 * which is a special case as they get replaced by the actual value and do not remain as a reference in the compiled code.
 * Meaning normal enums are bad, const enums can be used.
 *
 * You MUST NOT import anything else which remains as a reference in the code, as this will result in
 * a `... = require("homebridge");` to be compiled into the final Javascript code.
 * This typically leads to unexpected behavior at runtime, as in many cases it won't be able to find the module
 * or will import another instance of homebridge causing collisions.
 *
 * To mitigate this the {@link API | Homebridge API} exposes the whole suite of HAP-NodeJS inside the `hap` property
 * of the api object, which can be acquired for example in the initializer function. This reference can be stored
 * like this for example and used to access all exported variables and classes from HAP-NodeJS.
 */
let hap: HAP;
let Accessory: typeof PlatformAccessory;

export = (api: API) => {
  hap = api.hap;
  Accessory = api.platformAccessory;

  api.registerPlatform(PLATFORM_NAME, SmartglassPlatform);
};

class SmartglassPlatform implements DynamicPlatformPlugin {

  private readonly log: Logging;
  private readonly api: API;
  private readonly apiClient: any;

  private requestServer?: Server;

  private readonly accessories: PlatformAccessory[] = [];

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;

    this.apiClient = XboxApiClient({
      clientId: '5e5ead27-ed60-482d-b3fc-702b28a97404'
    });

    // probably parse config or something here

    log.info('Plugin loaded');

    /*
     * When this event is fired, homebridge restored all cached accessories from disk and did call their respective
     * `configureAccessory` method for all of them. Dynamic Platform plugins should only register new accessories
     * after this event was fired, in order to ensure they weren't added to homebridge already.
     * This event can also be used to start discovery of new accessories.
     */
    api.on(APIEvent.DID_FINISH_LAUNCHING, () => {
      log.info('Plugin restored devices:');
      
      // Check if user is authenticated
      this.apiClient.isAuthenticated().then(() => {
          // User is authenticated
          log.info('User is authenticated.')
          this.xboxDiscovery()
      
      }).catch((error: any) => {
          // User is not authenticated
          log.info('User is not authenticated. Starting flow...', error)
          
          var url = this.apiClient.startAuthServer(() => {

            this.apiClient.isAuthenticated().then(() => {
              log.info('Authentication is done. User logged in')
              this.xboxDiscovery()

            }).catch((error: any) => {
              log.info(error)
            })
            
          })
          log.info('Open the following link to authenticate:', url)
      })

      // // The idea of this plugin is that we open a http service which exposes api calls to add or remove accessories
      // this.createHttpService();
    });
  }

  /*
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory): void {
    this.log("Configuring accessory %s", accessory.displayName);

    accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
      this.log("%s identified!", accessory.displayName);
    });

    // accessory.getService(hap.Service.Lightbulb)!.getCharacteristic(hap.Characteristic.On)
    //   .on(CharacteristicEventTypes.SET, (value: CharacteristicValue, callback: CharacteristicSetCallback) => {
    //     this.log.info("%s Light was set to: " + value);
    //     callback();
    //   });

    this.accessories.push(accessory);
  }

  // --------------------------- CUSTOM METHODS ---------------------------

  addAccessory(name: string, liveid: string, consoletype: string) {
    // uuid must be generated from a unique but not changing data source, name should not be used in the most cases. But works in this specific example.
    const uuid = hap.uuid.generate('homebridge:smartglass'+liveid);

    if (!this.accessories.find(accessory => accessory.UUID === uuid)) {
      this.log.info("Adding new accessory with name %s", name);
      const accessory = new Accessory(name, uuid);

      accessory.category = this.api.hap.Categories.TELEVISION;

      var televisionService: any = accessory.addService(hap.Service.Television)
        .setCharacteristic(hap.Characteristic.ConfiguredName, name)
        .setCharacteristic(hap.Characteristic.SleepDiscoveryMode, hap.Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE)
        .setCharacteristic(hap.Characteristic.ActiveIdentifier, 2)
        .setCharacteristic(hap.Characteristic.Active, 1)

      televisionService.getCharacteristic(hap.Characteristic.CurrentMediaState)
        .on('get', (callback: Function) => {
          this.log.debug('Triggered GET CurrentMediaState');

          // set this to a valid value for CurrentMediaState
          const currentValue = 0;
      
          callback(null, currentValue);
        })

      televisionService.getCharacteristic(hap.Characteristic.TargetMediaState)
        .on('get', (callback: Function) => {
          this.log.debug('Triggered GET TargetMediaState');

          // set this to a valid value for CurrentMediaState
          const currentValue = 0;
      
          callback(null, currentValue);
        })
        .on('set', (callback: Function) => {
          this.log.debug('Triggered GET TargetMediaState');

          // set this to a valid value for CurrentMediaState
          const currentValue = 0;
      
          callback(null);
        })

      // @TODO: Implement media state

      televisionService.getCharacteristic(hap.Characteristic.Active)
        .on('get', (callback: Function) => {
          this.log.info('Request power state');

          Smartglass().discovery().then((consoles: any) => {
            // console.log(consoles)
            for(var xbox in consoles){
              // console.log('- Device found: ' + consoles[xbox].message.name);
              // console.log('  Address: '+ consoles[xbox].remote.address + ':' + consoles[xbox].remote.port);
              // console.log(consoles[xbox].message.certificate)

              const certPem = '-----BEGIN CERTIFICATE-----\n'+consoles[xbox].message.certificate.toString('base64').match(/.{0,64}/g).join('\n')+'-----END CERTIFICATE-----'
              // console.log(certPem)
              pem.readCertificateInfo(certPem, (error: any, certInfo: any) => {
                  // console.log(error, certInfo)
                  // console.log(certInfo.commonName)

                  if(certInfo.commonName == liveid){
                    this.log.debug('Console is on:', liveid)
                    callback(null, true)
                  } else {
                    this.log.debug('Console is off:', liveid)
                    callback(null, false)
                  }
              })
            }
            // console.log(consoles.length)
            if(consoles.length == 0){
              this.log.debug('Console is off:', liveid)
              callback(null, false)
            }
          })

          // this.apiClient.getProvider('smartglass').getConsoleStatus(liveid).then((consoleStatus: any) => {
          //   this.log('consoleStatus', consoleStatus)

          //   // var currentState = televisionService.getCharacteristic(hap.Characteristic.Active).value
          //   // if(consoleStatus.powerState == 'On'){
          //   //   if(currentState != 1){
          //   //     televisionService.setCharacteristic(hap.Characteristic.Active, 1)
          //   //   }
          //   // } else {
          //   //   if(currentState != 0){
          //   //     televisionService.setCharacteristic(hap.Characteristic.Active, 0)
          //   //   }
          //   // }

          //   // Possible powerstates are:
          //   // On, ConnectedStandby, Off, SystemUpdate, Unknown
          //   if(consoleStatus.powerState == 'On'){
          //     callback(null, true)
          //   } else {
          //     callback(null, true)
          //   }
          // }).catch((error: any) => {
          //   this.log('consoleStatus error', error)
          //   callback(null)
          // })
        })
        .on('set', (state: Number, callback: Function) => {
          this.log.info('Set power state', state);
          if(televisionService.getCharacteristic(hap.Characteristic.Active).value == 1 && state == 0){
            this.log('Power off console')

            this.apiClient.getProvider('smartglass').powerOff(liveid).then((consoleStatus: any) => {
              console.log('power off result:', consoleStatus)
            })
          }
          if(televisionService.getCharacteristic(hap.Characteristic.Active).value == 0 && state == 1){
            this.log('Power on console')

            this.apiClient.getProvider('smartglass').powerOn(liveid).then((consoleStatus: any) => {
              console.log('power on result:', consoleStatus)
            })
          }
          callback(null)
        });

      televisionService.getCharacteristic(hap.Characteristic.ActiveIdentifier)
        .on('set', (newValue: Number, callback: Function) => {

          // the value will be the value you set for the Identifier Characteristic
          // on the Input Source service that was selected - see input sources below.

          this.log.info('set Active Identifier => setNewValue: ' + newValue);
          callback(null);
        })

      televisionService.getCharacteristic(hap.Characteristic.RemoteKey).on('set', (newValue: Number, callback: Function) => {
          this.log.info('set Remote Key Pressed: ', newValue)

          switch(newValue) {
            case hap.Characteristic.RemoteKey.REWIND: {
              this.log.info('set Remote Key Pressed: REWIND');
              break;
            }
            case hap.Characteristic.RemoteKey.FAST_FORWARD: {
              this.log.info('set Remote Key Pressed: FAST_FORWARD');
              break;
            }
            case hap.Characteristic.RemoteKey.NEXT_TRACK: {
              this.log.info('set Remote Key Pressed: NEXT_TRACK');
              break;
            }
            case hap.Characteristic.RemoteKey.PREVIOUS_TRACK: {
              this.log.info('set Remote Key Pressed: PREVIOUS_TRACK');
              break;
            }
            case hap.Characteristic.RemoteKey.ARROW_UP: {
              this.log.info('set Remote Key Pressed: ARROW_UP');
              this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Up').then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
            case hap.Characteristic.RemoteKey.ARROW_DOWN: {
              this.log.info('set Remote Key Pressed: ARROW_DOWN');
              this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Down').then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
            case hap.Characteristic.RemoteKey.ARROW_LEFT: {
              this.log.info('set Remote Key Pressed: ARROW_LEFT');
              this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Left').then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
            case hap.Characteristic.RemoteKey.ARROW_RIGHT: {
              this.log.info('set Remote Key Pressed: ARROW_RIGHT');
              this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'Right').then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
            case hap.Characteristic.RemoteKey.SELECT: {
              this.log.info('set Remote Key Pressed: SELECT');
              break;
            }
            case hap.Characteristic.RemoteKey.BACK: {
              this.log.info('set Remote Key Pressed: BACK');
              this.apiClient.getProvider('smartglass').sendButtonPress(liveid, 'B').then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
            case hap.Characteristic.RemoteKey.EXIT: {
              this.log.info('set Remote Key Pressed: EXIT');
              break;
            }
            case hap.Characteristic.RemoteKey.PLAY_PAUSE: {
              this.log.info('set Remote Key Pressed: PLAY_PAUSE');
              break;
            }
            case hap.Characteristic.RemoteKey.INFORMATION: {
              this.log.info('set Remote Key Pressed: INFORMATION');
              this.apiClient.getProvider('smartglass').openGuideTab(liveid).then(() => {}).catch((error: any) => {
                this.log.info('Error sending button press:', error)
              })
              break;
            }
          }

          callback(null);
        })
      

      var informationService: any = accessory.getService(hap.Service.AccessoryInformation)
      informationService.setCharacteristic(hap.Characteristic.Manufacturer, 'Microsoft')
        .setCharacteristic(hap.Characteristic.Model, consoletype)
        .setCharacteristic(hap.Characteristic.SerialNumber, liveid)
        .setCharacteristic(hap.Characteristic.FirmwareRevision, Package.version)

      var inputSourceDashboard: any = accessory.addService(hap.Service.InputSource, 'dashboard', 'Dashboard')
      inputSourceDashboard.setCharacteristic(hap.Characteristic.Identifier, 1)
        .setCharacteristic(hap.Characteristic.ConfiguredName, 'Dashboard')
        .setCharacteristic(hap.Characteristic.IsConfigured, hap.Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(hap.Characteristic.InputSourceType, hap.Characteristic.InputSourceType.HOME_SCREEN)
      televisionService.addLinkedService(inputSourceDashboard);

      var inputSourceTv: any = accessory.addService(hap.Service.InputSource, 'tv', 'TV')
      inputSourceTv.setCharacteristic(hap.Characteristic.Identifier, 2)
        .setCharacteristic(hap.Characteristic.ConfiguredName, 'TV')
        .setCharacteristic(hap.Characteristic.IsConfigured, hap.Characteristic.IsConfigured.CONFIGURED)
        .setCharacteristic(hap.Characteristic.InputSourceType, hap.Characteristic.InputSourceType.TUNER)
      televisionService.addLinkedService(inputSourceTv);

      // @TODO: Add apps from pins

      this.configureAccessory(accessory); // abusing the configureAccessory here

      // this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      this.api.publishExternalAccessories(PLUGIN_NAME, [accessory]);
    } else {
      this.log.info("Accessory already exists: %s", name);
    }
  }

  removeAccessories() {
    // we don't have any special identifiers, we just remove all our accessories

    this.log.info("Removing all accessories");

    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, this.accessories);
    this.accessories.splice(0, this.accessories.length); // clear out the array
  }

  xboxDiscovery() {
    this.log.info("Refreshing list of xbox consoles");

    this.apiClient.getProvider('smartglass').getConsolesList().then((result: any) => {
      this.log.info('Xbox consoles found:', result.result)

      this.removeAccessories()
      for(let device in result.result){
        this.addAccessory(result.result[device].name, result.result[device].id, result.result[device].consoleType)
      }
    }).catch((error: any) => {
      this.log.info('Error refreshing consoles:', error)
    })
  }

  // createHttpService() {
  //   this.requestServer = http.createServer(this.handleRequest.bind(this));
  //   this.requestServer.listen(18081, () => this.log.info("Http server listening on 18081..."));
  // }

  // private handleRequest(request: IncomingMessage, response: ServerResponse) {
  //   if (request.url === "/add") {
  //     this.addAccessory(new Date().toISOString());
  //   } else if (request.url === "/remove") {
  //     this.removeAccessories();
  //   }

  //   response.writeHead(204); // 204 No content
  //   response.end();
  // }

  // ----------------------------------------------------------------------

}
# Homebridge-Smartglass

This module is an Accessory plugin for Homebridge which allows you to control your Xbox using Homekit and the new Remote control introduced in iOS 12.2.
Currently still in beta.

Requirements:
- xbox-smartglass-core-node >= 0.4.2
- Python 2
- pip install cryptography

### How to install

Install the plugin:

    npm install -g homebridge-smartglass

### HOOBS instructions

1. Search for the plugin using `smartglass`

2. Go to startup settings (Docker icon -> Startup Script) and add the 2 lines below

    apk add --no-cache python2 python2-dev py2-pip gcc
    
    pip install cryptography

3. Restart the HOOBS container (Docker icon -> Restart Container). This can take a couple minutes to come back. It will install all the required dependencies. (Up to 10 minutes, this is a one-time thing)

### Homebridge configuration

Add the Accessory in your Homebridge config:

    "accessories": [
        {
            "accessory": "Smartglass",
            "name": "Xbox One",
            "liveid": "FD00000000000000",
            "consoleip": "192.168.2.5",
            "apps": [
                {
                    "name": "Spotify",
                    "uri": "SpotifyAB.SpotifyMusic-forXbox_zpdnekdrzrea0!App"
                },
                {
                    "name": "Youtube",
                    "uri": "GoogleInc.YouTube_yfg5n0ztvskxp!App"
                },
                {
                    "name": "Netflix",
                    "uri": "4DF9E0F8.Netflix_mcm4njqhnhss8!App"
                },
                {
                    "name": "Airserver",
                    "uri": "F3F176BD.53203526D8F6C_p8qzvses5c8me!AirServer",
                    "type": "Characteristic.InputSourceType.AIRPLAY"
                }
            ]
        }
    ],

| Key | Explanation |
|-----|-------------|
| `liveid` | This needs to contain your Xbox live id. You can get this live id in the console settings. |
| `consoleip` | This needs to contain your xbox console ip. Best is to set a static ip on the console. |
| `apps` | This part is optional. You can define extra apps here to show them in Homekit |


### Known issues

- Bug: Plugin can crash homebridge sometimes, it is still in beta!
- Only one Xbox per homebridge instance is tested.

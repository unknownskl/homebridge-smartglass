# Homebridge-Smartglass

This module is an Accessory plugin for Homebridge which allows you to control your Xbox using Homekit and the new Remote control introduced in iOS 12.2.
Currently still in beta.

Requirements:
- xbox-smartglass-rest-python
- xbox-smartglass-core-node

### Easy way up?

Using docker you can get the xbox-smartglass-rest-python server up in no-time. Use the following `docker-compose.yml` image to run the server in docker (Works on the Raspberry Pi).

    version: '2'

    services:
      rest:
        image: unknownskl/xbox-smartglass-rest-python
        ports:
        - 5557:5557

Install the plugin:

    npm install -g homebridge-smartglass

Add the Accessory in your Homebridge config:

    "accessories": [
        {
            "accessory": "Smartglass",
            "name": "Xbox One",
            "address": "127.0.0.1",
            "port": 5557,
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

`address` needs to contain the address to the xbox-smartglass-rest-python server. If the docker image runs remotely, you need to change the ip.

`liveid` needs to contain your Xbox live id. You can get this live id in the console settings.

`consoleip` needs to contain your xbox console ip. Best is to set a static ip on the console.

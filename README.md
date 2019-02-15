# Homebridge-Smartglass

This module is an Accessory plugin for Homebridge which allows you to control your Xbox using Homekit and the new Remote control introduced in iOS 12.2.

Requirements:
- xbox-smartglass-rest-python
- xbox-smartglass-core-node

### Easy way up?

Using docker you can get the xbox-smartglass-rest-python server up in no-time. Use the following image to run.

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
            "consoleip": "192.168.2.5"
        }
    ],

`address` needs to contain the address to the xbox-smartglass-rest-python server. If the docker image runs remotely, you need to change the ip.

`liveid` needs to contain your Xbox live id. You can get this live id in the console settings.

`consoleip` needs to contain your xbox console ip. Best is to set a static ip on the console.

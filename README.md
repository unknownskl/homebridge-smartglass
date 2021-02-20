# Homebridge-Smartglass

[![Build and Lint](https://github.com/unknownskl/homebridge-smartglass/actions/workflows/build.yml/badge.svg?branch=release%2F1.0.1)](https://github.com/unknownskl/homebridge-smartglass/actions/workflows/build.yml)
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass?ref=badge_shield)


This module is an Accessory plugin for Homebridge which allows you to control your Xbox using Homekit and the new Remote control introduced in iOS 12.2.
Currently still in beta.

Requirements:
- NodeJS >= 10.x

### How to install

Install the plugin:

    npm install -g homebridge-smartglass

### HOOBS instructions

1. Search for the plugin using `smartglass`
2. Install plugin and configure

## Setting up the Xbox

The plugin needs to be allowed to connect to your Xbox. To allow this make sure you set the setting to allow anonymous connections in Settings -> Devices -> Connections on the Xbox.

### Homebridge configuration

Add the Platform in your Homebridge config:

    "platforms": [
      {
        "platform": "Smartglass",
        "devices": [
          {
            "name": "Xbox Series S",
            "ipaddress": "192.168.2.9",
            "liveid": "F400000000000000",
            "inputs": [
              {
                "name": "Twitch",
                "aum_id": "TwitchInteractive.TwitchApp_7kd9w9e3c5jra!Twitch",
                "title_id": "442736763"
              },
              {
                "name": "Spotify",
                "aum_id": "SpotifyAB.SpotifyMusic-forXbox_zpdnekdrzrea0!App",
                "title_id": "1693425033"
              },
              {
                "name": "Youtube",
                "aum_id": "GoogleInc.YouTube_yfg5n0ztvskxp!App",
                "title_id": "122001257"
              },
              {
                "name": "Destiny 2",
                "aum_id": "Bungie.Destiny2basegame_8xb1a0vv8ay84!tiger.ReleaseFinal",
                "title_id": "144389848"
              }
            ]
          }
        ]
      }
    ]

| Key | Explanation |
|-----|-------------|
| `name` | The name of the accesory to appear in Homekit |
| `liveid` | This needs to contain your Xbox live id. You can get this live id in the console settings. |
| `ipaddress` | This needs to contain your xbox console ip. Best is to set a static ip on the console. |
| `inputs` | This part is optional. You can define extra apps here to show them in Homekit and you can launch then when you supply a title_id |


### Known issues

- TV Controls can stop working after some usage. The client will reconnect when this happens.


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass?ref=badge_large)

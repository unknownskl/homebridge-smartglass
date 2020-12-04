# Homebridge-Smartglass
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass.svg?type=shield)](https://app.fossa.io/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass?ref=badge_shield)


Homebridge-Smartglass is an Accessory plugin for Homebridge which allows you to control your Xbox using Homekit and the new Remote control introduced in iOS 12.2.
Comminucation is done via the Xbox live api and leverages xbox-smartglass-core-node for the status dectection on the local network.

Requirements:
- NodeJS >= 10.x

### How to install

Install the plugin:

    npm install -g homebridge-smartglass

### HOOBS instructions

1. Search for the plugin using `smartglass`
2. Install plugin and configure

## Setting up the Xbox

You need to authenticate with the Xbox live api. Instructions for the authentication can be found in the log view.

### Homebridge configuration

Add the Accessory in your Homebridge config:

    "platform": [
        {
            "platform": "Smartglass",
            "apps": [
                "Spotify",
                "Twitch",
                "Destiny 2",
                "No mans sky"
            ]
        }
    ],


### Known issues

The plugin can have some quirks. Please open an issue if you have problems.


## License
[![FOSSA Status](https://app.fossa.io/api/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass.svg?type=large)](https://app.fossa.io/projects/git%2Bgithub.com%2Funknownskl%2Fhomebridge-smartglass?ref=badge_large)

# Changelog

## v1.0.2 -  2021-03-19
- Fixed a bug that can crash homebridge when no devices are defined in the config

## v1.0.1 -  2021-03-12
- Complete rewrite of the Smartglass plugin with xbox api functionalities. Allows you to launch apps and have realtime status of your console.

## 1.0.1-beta.6 -  2021-03-05
- Fixed a bug where the plugin could not turn on the console using the Xbox api because the tokens where expired
- Log available consoles to log when supplied an incorrect console live id

## 1.0.1-beta.5 -  2021-02-27
- Improved powerstate reliability

## 1.0.1-beta.4 -  2021-02-20
- Hotfix for a bug where the plugin stays connected but isnt connected resulting in not being able to remote control it.

## 1.0.1-beta.3 -  2021-02-20
- Improved reliability of the webapi
- Improved error reporting
import { API } from 'homebridge';

import { PLATFORM_NAME } from './Settings';
import { SmartglassPlatform } from './Platform';

export = (api: API): void => {
  api.registerPlatform(PLATFORM_NAME, SmartglassPlatform);
};
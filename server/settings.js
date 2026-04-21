'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_DIR = process.env.CCXRAY_HOME || path.join(os.homedir(), '.ccxray');
const SETTINGS_PATH = path.join(SETTINGS_DIR, 'settings.json');

const DEFAULTS = { statusLine: true };

function readSettings()
{
  try
  {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
  }
  catch
  {
    return { ...DEFAULTS };
  }
}

function writeSettings(data) {
  fs.mkdirSync(SETTINGS_DIR, { recursive: true });
  fs.writeFile(SETTINGS_PATH, JSON.stringify(data, null, 2), () => {});
}

module.exports = { readSettings, writeSettings };

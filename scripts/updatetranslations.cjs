const fs = require('fs');
const path = require('path');
const merge = require('@eartharoid/deep-merge');

const compareAndRemoveKeys = (json1, json2) => {
  for (let key in json1) {
    if (json2.hasOwnProperty(key)) {
      if (typeof json1[key] === 'object' && typeof json2[key] === 'object') {
        compareAndRemoveKeys(json1[key], json2[key]);
      }
    } else {
      delete json1[key];
    }
  }
};

const localesDir = path.resolve(__dirname, '../src/i18n/locales');
const achievementsDir = path.resolve(localesDir, 'achievements');

const getLocalePath = (baseDir, file) => {
  if (typeof file !== 'string' || !/^[A-Za-z0-9_-]+\.json$/.test(file)) {
    return null;
  }

  const resolvedPath = path.resolve(baseDir, file);
  if (!resolvedPath.startsWith(`${baseDir}${path.sep}`)) {
    return null;
  }

  return resolvedPath;
};

const isRegularFile = (filePath) => {
  try {
    return fs.lstatSync(filePath).isFile();
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

const pathExists = (filePath) => {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
};

// Check if the locales directory exists, if not, create it
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir, { recursive: true });
}

// Check if the achievements directory exists, if not, create it
if (!fs.existsSync(achievementsDir)) {
  fs.mkdirSync(achievementsDir, { recursive: true });
}

fs.readdirSync(localesDir).forEach((file) => {
  if (file === 'en_GB.json') {
    return;
  }

  const localePath = getLocalePath(localesDir, file);
  if (!localePath || !isRegularFile(localePath)) {
    return;
  }

  const enGBPath = getLocalePath(localesDir, 'en_GB.json');
  if (!isRegularFile(enGBPath)) {
    return;
  }

  const en = require(enGBPath);
  const newdata = merge(en, require(localePath));

  compareAndRemoveKeys(newdata, en);

  fs.writeFileSync(localePath, JSON.stringify(newdata, null, 2));

  fs.appendFileSync(localePath, '\n');
});

fs.readdirSync(achievementsDir).forEach((file) => {
  if (file === 'en_GB.json') {
    return;
  }

  const achievementPath = getLocalePath(achievementsDir, file);
  if (!achievementPath || !isRegularFile(achievementPath)) {
    return;
  }

  const enGBFilePath = getLocalePath(achievementsDir, 'en_GB.json');
  if (!isRegularFile(enGBFilePath)) {
    console.error(`File 'en_GB.json' does not exist in the directory '${achievementsDir}'`);
    return;
  }

  const en = require(enGBFilePath);
  const newdata = merge(en, require(achievementPath));

  compareAndRemoveKeys(newdata, en);

  fs.writeFileSync(achievementPath, JSON.stringify(newdata, null, 2));

  fs.appendFileSync(achievementPath, '\n');

  const locales = fs.readdirSync(localesDir);
  locales.forEach((locale) => {
    const localePath = getLocalePath(localesDir, locale);
    const achievementLocalePath = getLocalePath(achievementsDir, locale);
    if (!localePath || !achievementLocalePath || !isRegularFile(localePath)) {
      return;
    }

    if (!pathExists(achievementLocalePath)) {
      fs.writeFileSync(achievementLocalePath, JSON.stringify(en, null, 2));
      fs.appendFileSync(achievementLocalePath, '\n');
    }
  });
});

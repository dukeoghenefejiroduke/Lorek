const fs = require('fs');
const path = require('path');
const axios = require('axios');

const packageJsonPath = path.join(__dirname, '../package.json');
const appJsonPath = path.join(__dirname, '../app.json');

// Get API URL from process env or default
const API_URL = process.env.API_URL || 'https://api.izonlanguage.com/api';

const bumpVersion = async (type = 'patch') => {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  
  let [major, minor, patch] = packageJson.version.split('.').map(Number);
  
  if (type === 'major') major++;
  else if (type === 'minor') minor++;
  else patch++;
  
  const newVersion = `${major}.${minor}.${patch}`;
  
  packageJson.version = newVersion;
  appJson.expo.version = newVersion;
  
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
  
  console.log(`✅ Local version bumped to ${newVersion} (${type})`);

  // Push to backend
  try {
    console.log(`📡 Pushing new version ${newVersion} to backend at ${API_URL}/admin/version...`);
    await axios.post(`${API_URL}/admin/version`, 
      { latestVersion: newVersion }
    );
    console.log('✅ Backend version updated successfully.');
  } catch (error) {
    console.error('❌ Failed to update backend version:', error.message);
  }
};

const args = process.argv.slice(2);
bumpVersion(args[0]);

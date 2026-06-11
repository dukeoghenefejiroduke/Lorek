const fs = require('fs');
const path = require('path');

const screensDir = './frontend/src/screens';

// Pattern to match: <View style={[styles.container, ...]}
// We want to replace it with <SafeAreaView style={[styles.container, ...]}
const searchPattern = /<View\s+style=\{(.*)styles\.container(.*)\}>/g;
const replacement = '<SafeAreaView style={$1styles.container$2}>';

fs.readdirSync(screensDir).forEach(file => {
  if (!file.endsWith('.js')) return;

  const filePath = path.join(screensDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Ensure SafeAreaView is imported
  if (content.includes('SafeAreaView') || !content.includes('import')) return;

  // Add SafeAreaView to imports
  content = content.replace(
    /import\s+\{(.*)\}\s+from\s+'react-native';/,
    "import {\n  $1,\n  SafeAreaView,\n} from 'react-native';"
  );

  // Replace top-level View
  if (content.includes('styles.container')) {
    content = content.replace(searchPattern, replacement);
    // Need to handle closing tag
    content = content.replace(/<\/View>/, '</SafeAreaView>');
  }

  fs.writeFileSync(filePath, content);
  console.log(`Updated ${file}`);
});

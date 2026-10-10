const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/modules/building-device/dto/building-device-attributes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Remove @IsBoolean(), @IsNumber(), @IsString()
  content = content.replace(/@IsBoolean\(\)\s*\n/g, '');
  content = content.replace(/@IsNumber\(\)\s*\n/g, '');
  content = content.replace(/@IsNumber\(\{[^\}]*\}\)\s*\n/g, '');
  content = content.replace(/@IsString\(\)\s*\n/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Stripped strict types from', file);
  }
});

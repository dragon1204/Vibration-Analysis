const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '../src/modules/building-device/dto/building-device-attributes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.ts'));

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  // Add IsOptional to imports if missing
  if (!content.includes('IsOptional') && content.includes('class-validator')) {
    content = content.replace(/import \{(.*?)\} from 'class-validator';/, (match, p1) => {
      return `import { ${p1.trim()}, IsOptional } from 'class-validator';`;
    });
    changed = true;
  } else if (!content.includes('class-validator')) {
    content = `import { IsOptional } from 'class-validator';\n` + content;
    changed = true;
  }

  // Find all decorators like @IsNumber(), @IsBoolean(), etc.
  // And ensure @IsOptional() is right above them if not already there
  const regex = /^(?!.*\/\/.*)(.*)(@IsNumber|@IsBoolean|@IsString|@IsEnum)/gm;
  content = content.replace(regex, (match, before, dec) => {
    // Check if previous line has @IsOptional (roughly, or if this match already includes it)
    if (before.includes('@IsOptional')) return match;
    return before + '@IsOptional()\n' + before + dec;
  });

  // Make TS properties optional (add ?)
  const propRegex = /(@(?:IsNumber|IsBoolean|IsString|IsEnum).*?\s+)(\w+)(?!\?)(:\s+\w+;)/gs;
  content = content.replace(propRegex, (match, prefix, propName, suffix) => {
    return `${prefix}${propName}?${suffix}`;
  });

  if (content !== fs.readFileSync(filePath, 'utf8')) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Fixed', file);
  }
});

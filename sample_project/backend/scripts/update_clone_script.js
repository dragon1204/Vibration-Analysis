const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'clone-devices-building2.js');
let content = fs.readFileSync(file, 'utf8');

// The regex will find positions: [[x,y],[x,y]...] and subtract 10 from every number inside
content = content.replace(/positions:\s*\[(.*?)\]/g, (match, p1) => {
  const updatedP1 = p1.replace(/\[([^\]]+)\]/g, (innerMatch, innerP1) => {
    const coords = innerP1.split(',').map(n => parseInt(n.trim(), 10) - 10);
    return `[${coords.join(',')}]`;
  });
  return `positions: [${updatedP1}]`;
});

// Also update the comment in the header
content = content.replace(
  'positions: mảng [x, y] chuẩn hóa 0..20',
  'positions: mảng [x, y] chuẩn hóa -10..10'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully reverted clone-devices-building2.js coordinates!');

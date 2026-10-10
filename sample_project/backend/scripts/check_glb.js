const fs = require('fs');

const data = fs.readFileSync('D:\\Yootek\\DEV\\DATN\\frontend\\public\\models\\3.glb');
const magic = data.readUInt32LE(0);
if (magic !== 0x46546C67) {
  console.log('Not a valid GLB file');
  process.exit(1);
}

const version = data.readUInt32LE(4);
const length = data.readUInt32LE(8);

let offset = 12;
let jsonChunkLength = data.readUInt32LE(offset);
let jsonChunkType = data.readUInt32LE(offset + 4);

if (jsonChunkType !== 0x4E4F534A) {
  console.log('First chunk is not JSON');
  process.exit(1);
}

const jsonBuffer = data.slice(offset + 8, offset + 8 + jsonChunkLength);
const jsonString = jsonBuffer.toString('utf8');
const gltf = JSON.parse(jsonString);

console.log('Nodes:');
for (let i = 0; i < gltf.nodes.length; i++) {
  const node = gltf.nodes[i];
  if (node.name && (node.name.startsWith('tang') || node.name.startsWith('floor'))) {
    console.log(`Node ${i}: ${node.name}`, node.translation || 'no translation');
    if (node.children) {
      console.log(`  Children: ${node.children.join(', ')}`);
      for (const childIndex of node.children) {
        const child = gltf.nodes[childIndex];
        console.log(`  Child ${childIndex}: ${child.name}`, child.translation || 'no translation');
      }
    }
  }
}

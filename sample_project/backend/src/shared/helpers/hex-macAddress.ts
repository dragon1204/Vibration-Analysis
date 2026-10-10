export const parseI3eToMac = (i3e: string) => {
  const ieeeStr = i3e.replace(/^0x/, '');
  // Add colon `:` formatting
  const formattedMac = ieeeStr
    .match(/.{1,2}/g) // Split into pairs of 2 characters
    .join(':');
  return formattedMac;
};

export const parseMacToI3e = (mac: string) => {
  return '0x' + mac.replace(/:/g, '');
};

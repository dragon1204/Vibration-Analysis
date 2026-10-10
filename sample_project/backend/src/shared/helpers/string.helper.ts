export const correctMacAddress = (macAddress: string, noSeparator = true) => {
  if (noSeparator) {
    // remove all colons
    macAddress = macAddress.replace(/:/g, '');
    // after 2 characters, add a colon
    macAddress = macAddress.replace(/(.{2})/g, '$1:');
    // remove the last colon
    macAddress = macAddress.slice(0, -1);
  }

  return macAddress.toLowerCase();
};

export const removeMacAddressColon = (macAddress: string) => {
  return macAddress.replace(/:/g, '').toLowerCase();
};

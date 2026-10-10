Date.prototype.toCHDate = function () {
  return this.toISOString().slice(0, 19).replace('T', ' ').replace('Z', '');
};

export {};

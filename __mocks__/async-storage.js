const store = {};
module.exports = {
  default: {
    getItem:    jest.fn((k) => Promise.resolve(store[k] ?? null)),
    setItem:    jest.fn((k, v) => { store[k] = v; return Promise.resolve(); }),
    removeItem: jest.fn((k) => { delete store[k]; return Promise.resolve(); }),
  },
};

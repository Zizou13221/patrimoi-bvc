const store = {};
module.exports = {
  setGenericPassword:   jest.fn((user, pass, opts) => { store[opts?.service ?? ''] = pass; return Promise.resolve(true); }),
  getGenericPassword:   jest.fn((opts) => { const v = store[opts?.service ?? '']; return Promise.resolve(v ? { username: 'supabase', password: v } : false); }),
  resetGenericPassword: jest.fn((opts) => { delete store[opts?.service ?? '']; return Promise.resolve(true); }),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly' },
};

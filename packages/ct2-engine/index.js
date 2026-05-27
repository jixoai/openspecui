const { assertSupportedCt2Runtime, normalizeForceWasiFlag } = require('./runtime-support.js')

normalizeForceWasiFlag(process.env)
assertSupportedCt2Runtime(__dirname)

module.exports = require('./binding.js')

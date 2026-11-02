function getCurrentTime() {
  // Check if a test time has been provided
  if (process.env.TEST_NOW) {
    return new Date(process.env.TEST_NOW);
  }

  // Otherwise, use the actual current time
  return new Date();
}

module.exports = {
  getCurrentTime
};